import { NextResponse } from "next/server";
import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAcademicYearFromDate, getAcademicYearRange } from "@/lib/academicYear";

const INTEREST_RATE_PER_MONTH = 0.02; // 2% per month simple interest (₹2 per ₹100/month)

export const dynamic = "force-dynamic";

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
    const requestedAYParam = searchParams.get("academicYear");

    // Reference settlement date
    const settlementDate = customSettlementDateStr
      ? new Date(customSettlementDateStr)
      : new Date();

    // Academic Year
    const academicYear = requestedAYParam || getAcademicYearFromDate(settlementDate);
    const { startDate: periodStart, endDate: periodEnd } = getAcademicYearRange(academicYear);

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

    // Check if account for this academic year is already settled
    const existingSettlement = farmer.annualSettlements.find(
      (s) => s.academicYear === academicYear
    );

    // Filter transactions strictly within this academic year window (periodStart to settlementDate)
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

    // ── 3. CROPS (UNSETTLED vs SETTLED) ──────────────────────────────────────
    // Settled Crops: ₹0 contribution, shown For Record Only
    // Unsettled Crops: Included in calculation, 0% interest
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
        return { ...log, amount, interest: 0, finalAmount: 0 };
      });

    const unsettledCropsTotal = unsettledCotton + unsettledMirchi;
    const settledCropsTotal = settledCotton + settledMirchi;

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

    // ── 5. MONEY GIVEN (LOAN REPAYMENTS) ──────────────────────────────────────
    let cashGivenPrincipal = 0;
    let cashGivenInterest = 0;
    const loanRepayments = cashInPeriod
      .filter((c) => c.type === "GIVEN")
      .map((cash) => {
        const days = Math.max(0, differenceInDays(settlementDate, new Date(cash.date)));
        const months = days / 30;
        const interest = cash.amount * INTEREST_RATE_PER_MONTH * months;
        cashGivenPrincipal += cash.amount;
        cashGivenInterest += interest;
        return { ...cash, days, interest, finalAmount: cash.amount + interest };
      });

    // ── FINAL FORMULA ─────────────────────────────────────────────────────────
    // Total Outstanding = Pesticides + Fertilizers + Unsettled Crops
    const pesticidesTotal = pesticidesPrincipal + pesticidesInterest;
    const fertilizersTotal = fertilizersPrincipal + fertilizersInterest;
    const totalOutstanding = pesticidesTotal + fertilizersTotal + unsettledCropsTotal;

    // Total Money Given = Unsettled Crops + Cash Given
    const cashGivenTotal = cashGivenPrincipal + cashGivenInterest;
    const netMoneyBalance = (cashTakenPrincipal + cashTakenInterest) - cashGivenTotal;

    // Final Net Amount = Total Outstanding - Net Money Balance
    // (Pesticides + Fertilizers + Unsettled Crops) - (Money Taken - Money Given)
    // = Pesticides + Fertilizers + Cash Given - Money Taken
    const finalAmount = totalOutstanding - netMoneyBalance;

    let currentStatus = "UNSETTLED";
    let paymentStatus = "PENDING_DECISION";
    if (existingSettlement) {
      currentStatus = existingSettlement.status;
      paymentStatus = existingSettlement.paymentStatus;
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
      existingSettlement: existingSettlement || null,
      // Itemized sections
      pesticides,
      fertilizers,
      unsettledCrops,
      settledCropsForRecord,
      moneyTaken,
      loanRepayments,
      pastSettlements: farmer.annualSettlements,
      summary: {
        pesticidesPrincipal,
        pesticidesInterest,
        pesticidesTotal,
        fertilizersPrincipal,
        fertilizersInterest,
        fertilizersTotal,
        unsettledCotton,
        unsettledMirchi,
        unsettledCropsTotal,
        settledCotton,
        settledMirchi,
        settledCropsTotal,
        totalOutstanding,
        cashTakenPrincipal,
        cashTakenInterest,
        cashTakenTotal: cashTakenPrincipal + cashTakenInterest,
        cashGivenPrincipal,
        cashGivenInterest,
        cashGivenTotal,
        netMoneyBalance,
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
        { error: `This farmer's account for academic year ${academicYear} is already settled.` },
        { status: 400 }
      );
    }

    // Record settlement — NO automatic payment transaction yet. Admin decides next.
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
        interestRate: 2,
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
