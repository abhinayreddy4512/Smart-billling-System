import { NextResponse } from "next/server";
import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const INTEREST_RATE_PER_MONTH = 0.02; // 2% per month

export const dynamic = "force-dynamic";

/**
 * Compute academic year period: 1 Jun → 31 May
 * - If the first transaction is before 1 Jun, start is 1 Jun of prior year
 * - End is always 31 May of the next year after start
 */
function computeAcademicYear(firstDate: Date, referenceDate: Date) {
  // Use referenceDate (settlement date) to determine which academic year we're settling
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth(); // 0-indexed

  // If ref date is Jan-May, academic year started Jun of PREVIOUS year
  // If ref date is Jun-Dec, academic year started Jun of CURRENT year
  let startYear: number;
  if (refMonth < 5) {
    // Jan=0 to May=4: we're in the tail end of an academic year that started last June
    startYear = refYear - 1;
  } else {
    // Jun=5 to Dec=11: we're in a new academic year that started this June
    startYear = refYear;
  }

  const periodStart = new Date(startYear, 5, 1); // 1 June
  const periodEnd = new Date(startYear + 1, 4, 31); // 31 May next year
  const academicYear = `${startYear}-${String(startYear + 1).slice(2)}`; // e.g. "2025-26"

  return { periodStart, periodEnd, academicYear };
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

    const { searchParams } = new URL(request.url);
    const customSettlementDateStr = searchParams.get("settlementDate");

    // Settlement date = admin-selected date, or today
    const settlementDate = customSettlementDateStr
      ? new Date(customSettlementDateStr)
      : new Date();

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

    // Determine academic year from the settlement date
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

    const { periodStart, periodEnd, academicYear } = computeAcademicYear(firstDate, settlementDate);

    // Filter all transactions within the academic year window up to settlement date
    const billsInPeriod = farmer.bills.filter(
      (b) => new Date(b.date) >= periodStart && new Date(b.date) <= settlementDate
    );

    const cashInPeriod = farmer.cashTransactions.filter(
      (c) => new Date(c.date) >= periodStart && new Date(c.date) <= settlementDate
    );

    const cropsInPeriod = farmer.cropLogs.filter(
      (c) => new Date(c.date) >= periodStart && new Date(c.date) <= settlementDate
    );

    // ── 1. PESTICIDES ─────────────────────────────────────────────────────────
    let pesticidesPrincipal = 0;
    let pesticidesInterest = 0;
    const pesticides = billsInPeriod
      .filter((b) => b.category === "PESTICIDE")
      .map((bill) => {
        const days = Math.max(0, differenceInDays(settlementDate, new Date(bill.date)));
        const months = days / 30;
        const interest = bill.total * INTEREST_RATE_PER_MONTH * months;
        pesticidesPrincipal += bill.total;
        pesticidesInterest += interest;
        return { ...bill, days, interest, finalAmount: bill.total + interest };
      });

    // ── 2. FERTILIZERS ────────────────────────────────────────────────────────
    let fertilizersPrincipal = 0;
    let fertilizersInterest = 0;
    const fertilizers = billsInPeriod
      .filter((b) => b.category === "FERTILIZER")
      .map((bill) => {
        const days = Math.max(0, differenceInDays(settlementDate, new Date(bill.date)));
        const months = days / 30;
        const interest = bill.total * INTEREST_RATE_PER_MONTH * months;
        fertilizersPrincipal += bill.total;
        fertilizersInterest += interest;
        return { ...bill, days, interest, finalAmount: bill.total + interest };
      });

    // ── 3. CROPS — split settled vs unsettled ────────────────────────────────
    // IMPORTANT: Settled crops = NO contribution to financial calculation.
    //            They appear in PDF "For Record Only".
    // NO INTEREST on any crop (Cotton/Mirchi).

    let unsettledCotton = 0;
    let unsettledMirchi = 0;
    let settledCotton = 0;
    let settledMirchi = 0;

    const unsettledCrops = cropsInPeriod
      .filter((c) => !c.isSettled)
      .map((log) => {
        const amount = (log.totalWeight / 100) * (log.price || 0);
        if (log.cropType === "COTTON") unsettledCotton += amount;
        else unsettledMirchi += amount;
        return { ...log, amount, interest: 0, finalAmount: amount };
      });

    const settledCropsForRecord = cropsInPeriod
      .filter((c) => c.isSettled)
      .map((log) => {
        const amount = (log.totalWeight / 100) * (log.price || 0);
        if (log.cropType === "COTTON") settledCotton += amount;
        else settledMirchi += amount;
        return { ...log, amount, interest: 0, finalAmount: 0 }; // finalAmount=0: does NOT count
      });

    const unsettledCropsTotal = unsettledCotton + unsettledMirchi;

    // ── 4. MONEY TAKEN ────────────────────────────────────────────────────────
    let cashTakenPrincipal = 0;
    let cashTakenInterest = 0;
    const moneyTaken = cashInPeriod
      .filter((c) => c.type === "TAKEN")
      .map((cash) => {
        const days = Math.max(0, differenceInDays(settlementDate, new Date(cash.date)));
        const months = days / 30;
        const interest = cash.amount * INTEREST_RATE_PER_MONTH * months;
        cashTakenPrincipal += cash.amount;
        cashTakenInterest += interest;
        return { ...cash, days, interest, finalAmount: cash.amount + interest };
      });

    // ── 5. MONEY GIVEN ────────────────────────────────────────────────────────
    let cashGivenPrincipal = 0;
    let cashGivenInterest = 0;
    const moneyGiven = cashInPeriod
      .filter((c) => c.type === "GIVEN")
      .map((cash) => {
        const days = Math.max(0, differenceInDays(settlementDate, new Date(cash.date)));
        const months = days / 30;
        const interest = cash.amount * INTEREST_RATE_PER_MONTH * months;
        cashGivenPrincipal += cash.amount;
        cashGivenInterest += interest;
        return { ...cash, days, interest, finalAmount: cash.amount + interest };
      });

    // ── FINAL CALCULATION ─────────────────────────────────────────────────────
    // Total Outstanding = Pesticides + Fertilizers + Unsettled Crops
    const pesticidesTotal = pesticidesPrincipal + pesticidesInterest;
    const fertilizersTotal = fertilizersPrincipal + fertilizersInterest;
    const totalOutstanding = pesticidesTotal + fertilizersTotal + unsettledCropsTotal;

    // Net Money Balance = Money Taken Total - Money Given Total
    const cashTakenTotal = cashTakenPrincipal + cashTakenInterest;
    const cashGivenTotal = cashGivenPrincipal + cashGivenInterest;
    const netMoneyBalance = cashTakenTotal - cashGivenTotal;

    // Final Net Amount = Total Outstanding - Net Money Balance
    // Positive → Farmer owes Admin
    // Negative → Admin owes Farmer
    const finalAmount = totalOutstanding - netMoneyBalance;

    // ── SETTLEMENT STATUS ─────────────────────────────────────────────────────
    const existingSettlement = farmer.annualSettlements.find(
      (s) => s.academicYear === academicYear
    );

    let currentStatus = "PENDING";
    let paymentStatus = "PENDING_DECISION";
    const now = new Date();
    if (existingSettlement) {
      currentStatus = existingSettlement.status;
      paymentStatus = existingSettlement.paymentStatus;
    } else if (now > periodEnd) {
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
      academicYear,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      settlementDate: settlementDate.toISOString(),
      status: currentStatus,
      paymentStatus,
      isAlreadySettled: !!existingSettlement,
      existingSettlementId: existingSettlement?.id || null,
      // Itemized transaction lists
      pesticides,
      fertilizers,
      unsettledCrops,
      settledCropsForRecord,
      moneyTaken,
      moneyGiven,
      pastSettlements: farmer.annualSettlements,
      summary: {
        // Pesticides
        pesticidesPrincipal,
        pesticidesInterest,
        pesticidesTotal,
        // Fertilizers
        fertilizersPrincipal,
        fertilizersInterest,
        fertilizersTotal,
        // Unsettled Crops (NO interest)
        unsettledCotton,
        unsettledMirchi,
        unsettledCropsTotal,
        // Settled crops (record only)
        settledCotton,
        settledMirchi,
        settledCropsTotal: settledCotton + settledMirchi,
        // Total Outstanding
        totalOutstanding,
        // Money Taken
        cashTakenPrincipal,
        cashTakenInterest,
        cashTakenTotal,
        // Money Given
        cashGivenPrincipal,
        cashGivenInterest,
        cashGivenTotal,
        // Net Money Balance
        netMoneyBalance,
        // Final
        interestRate: INTEREST_RATE_PER_MONTH * 100,
        totalInterest: pesticidesInterest + fertilizersInterest + cashTakenInterest - cashGivenInterest,
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
      academicYear,
      periodStart,
      periodEnd,
      settlementDate,
      status = "MANUALLY_SETTLED",
      summary,
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

    const actualSettlementDate = settlementDate ? new Date(settlementDate) : new Date();

    // Prevent duplicate settlement for same academic year
    const existing = await prisma.annualSettlement.findFirst({
      where: { farmerId: farmer.id, academicYear: academicYear || "" },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This account has already been settled for this academic year." },
        { status: 400 }
      );
    }

    // Record settlement — NO automatic payment transaction yet.
    // Admin must choose "Paid" or "Carry Forward" next.
    const settlement = await prisma.annualSettlement.create({
      data: {
        farmerId: farmer.id,
        periodStart: new Date(periodStart),
        periodEnd: actualSettlementDate,
        academicYear: academicYear || "",
        status,
        paymentStatus: "PENDING_DECISION",
        totalPurchases: (summary.pesticidesPrincipal + summary.fertilizersPrincipal) || 0,
        totalCashTaken: summary.cashTakenPrincipal || 0,
        totalCashGiven: summary.cashGivenPrincipal || 0,
        totalCotton: summary.unsettledCotton || 0,
        totalMirchi: summary.unsettledMirchi || 0,
        shopPurchases: summary.totalOutstanding || 0,
        moneyDiff: summary.netMoneyBalance || 0,
        unsettledCrops: summary.unsettledCropsTotal || 0,
        principal: summary.totalOutstanding - summary.netMoneyBalance || 0,
        interestRate: summary.interestRate || 2,
        interestAmount: summary.totalInterest || 0,
        totalAmount: summary.finalAmount,
      },
    });

    return NextResponse.json({ settlement, needsDecision: true });
  } catch (error: any) {
    console.error("Error saving annual settlement:", error);
    return NextResponse.json(
      { error: "Failed to save settlement" },
      { status: 500 }
    );
  }
}
