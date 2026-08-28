import { NextResponse } from "next/server";
import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const INTEREST_RATE_PER_MONTH = 0.02; // 2% per month

export const dynamic = "force-dynamic";

/**
 * Compute settlement period:
 * - Start = farmer's first bill/transaction date
 * - End = May 1 of the following year from the start date
 */
function computeSettlementPeriod(firstBillDate: Date) {
  const start = new Date(firstBillDate);
  let endYear = start.getFullYear();

  // If first transaction is on or after May 1, settlement period ends May 1 of NEXT year
  const may1SameYear = new Date(endYear, 4, 1); // 4 = May (0-indexed)
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

    // Find earliest transaction date
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

    // Reference date for interest calculation is periodEnd
    const referenceDate = periodEnd;

    // Filter transactions within the settlement period
    const billsInPeriod = farmer.bills.filter(
      (b) => new Date(b.date) >= periodStart && new Date(b.date) <= periodEnd
    );

    const cashInPeriod = farmer.cashTransactions.filter(
      (c) => new Date(c.date) >= periodStart && new Date(c.date) <= periodEnd
    );

    const cropsInPeriod = farmer.cropLogs.filter(
      (c) => new Date(c.date) >= periodStart && new Date(c.date) <= periodEnd
    );

    // 1. Process Purchases (Fertilizers & Pesticides) - Accrues Interest
    let totalPurchasesPrincipal = 0;
    let totalPurchaseInterest = 0;

    const processedBills = billsInPeriod.map((bill) => {
      const days = Math.max(0, differenceInDays(referenceDate, new Date(bill.date)));
      const months = days / 30;
      const interest = bill.total * INTEREST_RATE_PER_MONTH * months;
      totalPurchasesPrincipal += bill.total;
      totalPurchaseInterest += interest;
      return { ...bill, days, interest, finalAmount: bill.total + interest };
    });

    const shopPurchasesTotal = totalPurchasesPrincipal + totalPurchaseInterest;

    // 2. Process Cash Transactions - Accrues Interest
    let totalCashTakenPrincipal = 0;
    let totalCashTakenInterest = 0;
    let totalCashGivenPrincipal = 0;
    let totalCashGivenInterest = 0;

    const processedCash = cashInPeriod.map((cash) => {
      const days = Math.max(0, differenceInDays(referenceDate, new Date(cash.date)));
      const months = days / 30;
      const interest = cash.amount * INTEREST_RATE_PER_MONTH * months;
      if (cash.type === "TAKEN") {
        totalCashTakenPrincipal += cash.amount;
        totalCashTakenInterest += interest;
        return { ...cash, days, interest, finalAmount: cash.amount + interest };
      } else {
        totalCashGivenPrincipal += cash.amount;
        totalCashGivenInterest += interest;
        return { ...cash, days, interest, finalAmount: cash.amount + interest };
      }
    });

    const cashTakenTotal = totalCashTakenPrincipal + totalCashTakenInterest;
    const cashGivenTotal = totalCashGivenPrincipal + totalCashGivenInterest;
    const moneyTransactionDiff = cashTakenTotal - cashGivenTotal;

    // 3. Process Cotton & Mirchi Crops - NO INTEREST APPLIED! (interest = 0)
    let totalCotton = 0;
    let totalMirchi = 0;

    const processedCrops = cropsInPeriod.map((log) => {
      const amount = (log.totalWeight / 100) * (log.price || 0);
      // NO INTEREST for cotton and mirchi!
      const interest = 0;

      if (log.cropType === "COTTON") {
        totalCotton += amount;
      } else {
        totalMirchi += amount;
      }

      return {
        ...log,
        amount,
        days: 0,
        interest: 0,
        finalAmount: amount,
      };
    });

    const unsettledCropsTotal = totalCotton + totalMirchi;

    // 4. Final Amount Calculation:
    // Shop Purchases + Money Transaction Difference - Unsettled Crops
    const finalAmount = shopPurchasesTotal + moneyTransactionDiff - unsettledCropsTotal;

    // Determine current settlement status
    const existingSettlement = farmer.annualSettlements.find(
      (s) =>
        new Date(s.periodEnd).getFullYear() === periodEnd.getFullYear()
    );

    const now = new Date();
    let currentStatus = "PENDING";
    if (existingSettlement) {
      currentStatus = existingSettlement.status;
    } else if (now >= periodEnd) {
      currentStatus = "AUTOMATICALLY_SETTLED";
    }

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
      status: currentStatus,
      isAlreadySettled: !!existingSettlement,
      processedBills,
      processedCash,
      processedCrops,
      pastSettlements: farmer.annualSettlements,
      summary: {
        totalPurchasesPrincipal,
        totalPurchaseInterest,
        shopPurchasesTotal,
        totalCashTakenPrincipal,
        totalCashTakenInterest,
        cashTakenTotal,
        totalCashGivenPrincipal,
        totalCashGivenInterest,
        cashGivenTotal,
        moneyTransactionDiff,
        totalCotton,
        totalMirchi,
        unsettledCropsTotal,
        principal: totalPurchasesPrincipal + totalCashTakenPrincipal - totalCashGivenPrincipal - unsettledCropsTotal,
        interestRate: INTEREST_RATE_PER_MONTH * 100,
        interestAmount: totalPurchaseInterest + totalCashTakenInterest - totalCashGivenInterest,
        finalAmount,
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
      status = "MANUALLY_SETTLED",
      shopPurchasesTotal,
      moneyTransactionDiff,
      unsettledCropsTotal,
      finalAmount,
      totalPurchasesPrincipal,
      totalCashTakenPrincipal,
      totalCashGivenPrincipal,
      totalCotton,
      totalMirchi,
      principal,
      interestRate,
      interestAmount,
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

    // Check if duplicate settlement exists
    const existing = await prisma.annualSettlement.findFirst({
      where: {
        farmerId: farmer.id,
        periodEnd: new Date(periodEnd),
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This account has already been settled for this period." },
        { status: 400 }
      );
    }

    // Automatic Bill / Cash Transaction Generation on Settlement
    let generatedReceiptNo = null;
    if (Math.abs(finalAmount) > 0.01) {
      // If finalAmount > 0: Farmer owes money to shop -> Record as TAKEN
      // If finalAmount < 0: Shop owes money to farmer -> Record as GIVEN
      const transactionType = finalAmount > 0 ? "TAKEN" : "GIVEN";
      const absAmount = Math.abs(finalAmount);

      // Find highest receiptNo
      const lastCash = await prisma.cashTransaction.findFirst({
        where: { farmerId: farmer.id },
        orderBy: { receiptNo: "desc" },
      });
      generatedReceiptNo = (lastCash?.receiptNo || 0) + 1;

      await prisma.cashTransaction.create({
        data: {
          receiptNo: generatedReceiptNo,
          farmerId: farmer.id,
          type: transactionType,
          amount: absAmount,
          date: new Date(periodEnd),
          photoProof: null,
        },
      });
    }

    // Record Annual Settlement
    const settlement = await prisma.annualSettlement.create({
      data: {
        farmerId: farmer.id,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        status,
        totalPurchases: totalPurchasesPrincipal || 0,
        totalCashTaken: totalCashTakenPrincipal || 0,
        totalCashGiven: totalCashGivenPrincipal || 0,
        totalCotton: totalCotton || 0,
        totalMirchi: totalMirchi || 0,
        shopPurchases: shopPurchasesTotal || 0,
        moneyDiff: moneyTransactionDiff || 0,
        unsettledCrops: unsettledCropsTotal || 0,
        principal: principal || 0,
        interestRate: interestRate || 2,
        interestAmount: interestAmount || 0,
        totalAmount: finalAmount,
        generatedReceiptNo,
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
