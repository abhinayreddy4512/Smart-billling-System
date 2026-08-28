import { NextResponse } from "next/server";
import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const INTEREST_RATE_PER_MONTH = 0.02; // 2% per month

export const dynamic = "force-dynamic";

/**
 * Compute settlement period:
 * - Start = farmer's first bill date
 * - End = May 1 of the following year from the start date
 *   (If the first bill is after May 1, settlement ends on May 1 of the year after that.)
 */
function computeSettlementPeriod(firstBillDate: Date) {
  const start = new Date(firstBillDate);
  let endYear = start.getFullYear();

  // If the first bill is on or after May 1, the settlement period ends May 1 of the NEXT year
  // If before May 1, the settlement period ends May 1 of the SAME year
  const may1SameYear = new Date(endYear, 4, 1); // Month is 0-indexed: 4 = May
  if (start >= may1SameYear) {
    endYear += 1;
  }
  const end = new Date(endYear, 4, 1); // May 1

  return { start, end };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const shopInfo = session.user;

    const farmer = await prisma.farmer.findUnique({
      where: {
        userId_farmerNo: {
          userId: session.user.id,
          farmerNo: id.toUpperCase(),
        },
      },
      include: {
        bills: { orderBy: { date: "asc" } },
        cashTransactions: { orderBy: { date: "asc" } },
        cropLogs: { orderBy: { date: "asc" } },
        cropSettlements: { orderBy: { date: "asc" } },
        annualSettlements: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    // Find the earliest date from all transaction types
    const allDates: Date[] = [];
    farmer.bills.forEach((b) => allDates.push(new Date(b.date)));
    farmer.cashTransactions.forEach((c) => allDates.push(new Date(c.date)));
    farmer.cropLogs.forEach((c) => allDates.push(new Date(c.date)));

    if (allDates.length === 0) {
      return NextResponse.json(
        { error: "No transactions found for this farmer." },
        { status: 400 }
      );
    }

    allDates.sort((a, b) => a.getTime() - b.getTime());
    const firstDate = allDates[0];
    const { start: periodStart, end: periodEnd } = computeSettlementPeriod(firstDate);

    // Use periodEnd as the reference date for interest calculation (not today)
    const referenceDate = periodEnd;

    // ---- Filter transactions within the settlement period ----
    const billsInPeriod = farmer.bills.filter(
      (b) => new Date(b.date) >= periodStart && new Date(b.date) < periodEnd
    );

    const cashInPeriod = farmer.cashTransactions.filter(
      (c) => new Date(c.date) >= periodStart && new Date(c.date) < periodEnd
    );

    const cropsInPeriod = farmer.cropLogs.filter(
      (c) => new Date(c.date) >= periodStart && new Date(c.date) < periodEnd
    );

    const cropSettlementsInPeriod = farmer.cropSettlements.filter(
      (s) => new Date(s.date) >= periodStart && new Date(s.date) < periodEnd
    );

    // ---- Process & Calculate Interest ----
    let totalPurchases = 0;
    let totalPurchaseInterest = 0;

    const processedBills = billsInPeriod.map((bill) => {
      const days = Math.max(0, differenceInDays(referenceDate, new Date(bill.date)));
      const months = days / 30;
      const interest = bill.total * INTEREST_RATE_PER_MONTH * months;
      totalPurchases += bill.total;
      totalPurchaseInterest += interest;
      return { ...bill, days, interest, finalAmount: bill.total + interest };
    });

    let totalCashTaken = 0;
    let totalCashTakenInterest = 0;
    let totalCashGiven = 0;
    let totalCashGivenInterest = 0;

    const processedCash = cashInPeriod.map((cash) => {
      const days = Math.max(0, differenceInDays(referenceDate, new Date(cash.date)));
      const months = days / 30;
      if (cash.type === "TAKEN") {
        const interest = cash.amount * INTEREST_RATE_PER_MONTH * months;
        totalCashTaken += cash.amount;
        totalCashTakenInterest += interest;
        return { ...cash, days, interest, finalAmount: cash.amount + interest };
      } else {
        const interest = cash.amount * INTEREST_RATE_PER_MONTH * months;
        totalCashGiven += cash.amount;
        totalCashGivenInterest += interest;
        return { ...cash, days, interest, finalAmount: cash.amount + interest };
      }
    });

    let totalCotton = 0;
    let totalCottonInterest = 0;
    let totalMirchi = 0;
    let totalMirchiInterest = 0;

    const processedCrops = cropsInPeriod.map((log) => {
      const amount = (log.totalWeight / 100) * (log.price || 0);
      const days = Math.max(0, differenceInDays(referenceDate, new Date(log.date)));
      const months = days / 30;
      const interest = amount * INTEREST_RATE_PER_MONTH * months;

      if (log.cropType === "COTTON") {
        totalCotton += amount;
        totalCottonInterest += interest;
      } else {
        totalMirchi += amount;
        totalMirchiInterest += interest;
      }

      return {
        ...log,
        amount,
        days,
        interest,
        finalAmount: amount + interest,
      };
    });

    const totalCropSettled = cropSettlementsInPeriod.reduce(
      (sum, s) => sum + s.amount,
      0
    );

    // Principal = (Purchases + CashTaken) - (CashGiven + Crops + CropSettlements)
    const principal =
      totalPurchases +
      totalCashTaken -
      totalCashGiven -
      (totalCotton + totalMirchi);

    const interestAmount =
      totalPurchaseInterest +
      totalCashTakenInterest -
      totalCashGivenInterest -
      (totalCottonInterest + totalMirchiInterest);

    const totalAmount = principal + interestAmount;

    return NextResponse.json({
      shopInfo,
      farmer: {
        id: farmer.id,
        farmerNo: farmer.farmerNo,
        name: farmer.name,
        phone: farmer.phone,
        email: farmer.email,
      },
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      processedBills,
      processedCash,
      processedCrops,
      pastSettlements: farmer.annualSettlements,
      summary: {
        totalPurchases,
        totalPurchaseInterest,
        totalCashTaken,
        totalCashTakenInterest,
        totalCashGiven,
        totalCashGivenInterest,
        totalCotton,
        totalCottonInterest,
        totalMirchi,
        totalMirchiInterest,
        totalCropSettled,
        principal,
        interestRate: INTEREST_RATE_PER_MONTH * 100,
        interestAmount,
        totalAmount,
      },
    });
  } catch (error: any) {
    console.error("Error calculating annual settlement:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      periodStart,
      periodEnd,
      totalPurchases,
      totalCashTaken,
      totalCashGiven,
      totalCotton,
      totalMirchi,
      principal,
      interestRate,
      interestAmount,
      totalAmount,
    } = body;

    const farmer = await prisma.farmer.findUnique({
      where: {
        userId_farmerNo: {
          userId: session.user.id,
          farmerNo: id.toUpperCase(),
        },
      },
    });

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    const settlement = await prisma.annualSettlement.create({
      data: {
        farmerId: farmer.id,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        totalPurchases,
        totalCashTaken,
        totalCashGiven,
        totalCotton,
        totalMirchi,
        principal,
        interestRate,
        interestAmount,
        totalAmount,
      },
    });

    return NextResponse.json(settlement);
  } catch (error: any) {
    console.error("Error saving annual settlement:", error);
    return NextResponse.json(
      { error: "Failed to save settlement" },
      { status: 500 }
    );
  }
}
