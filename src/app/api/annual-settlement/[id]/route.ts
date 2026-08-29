import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAcademicYearFromDate, getAcademicYearRange } from "@/lib/academicYear";
import { calculateSettlement } from "@/lib/settlementCalculator";

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

    const settlementDate = customSettlementDateStr
      ? new Date(customSettlementDateStr)
      : new Date();

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
        annualSettlements: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

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

    // Call unified calculation engine
    const calcResult = calculateSettlement({
      bills: billsInPeriod,
      cashTransactions: cashInPeriod,
      cropLogs: cropsInPeriod,
      settlementDate,
    });

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
      ...calcResult,
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

    const existing = await prisma.annualSettlement.findFirst({
      where: { farmerId: farmer.id, academicYear: academicYear || "" },
    });

    if (existing) {
      return NextResponse.json(
        { error: `This farmer's account for academic year ${academicYear} is already settled.` },
        { status: 400 }
      );
    }

    const settlement = await prisma.annualSettlement.create({
      data: {
        farmerId: farmer.id,
        periodStart: new Date(periodStart),
        periodEnd: actualSettlementDate,
        academicYear: academicYear || "",
        status,
        paymentStatus: "PENDING_DECISION",
        totalPurchases: summary.shopPurchasesTotal || 0,
        totalCashTaken: summary.cashTakenPrincipal || 0,
        totalCashGiven: summary.cashGivenPrincipal || 0,
        totalCotton: summary.unsettledCotton || 0,
        totalMirchi: summary.unsettledMirchi || 0,
        shopPurchases: summary.shopPurchasesTotal || 0,
        moneyDiff: summary.cashTakenTotal - summary.totalLoanRepayments || 0,
        unsettledCrops: summary.unsettledCropsTotal || 0,
        principal: summary.totalLiabilities - summary.totalLoanRepayments || 0,
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
