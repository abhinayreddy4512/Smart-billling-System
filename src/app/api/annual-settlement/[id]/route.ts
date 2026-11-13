import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { calculateSettlement } from "@/lib/settlementCalculator";
import {
  getFarmerAccountingCycles,
  filterTransactionsForCycle,
} from "@/lib/cycleManager";
import { format } from "date-fns";

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
    const requestedCycleId = searchParams.get("cycleId") || "active";

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
        annualSettlements: { orderBy: { periodEnd: "desc" } },
      },
    });

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    // Dynamically compute all accounting cycles for this farmer
    const allCycles = getFarmerAccountingCycles(farmer, settlementDate);

    // Pick target cycle
    const targetCycle =
      allCycles.find((c) => c.id === requestedCycleId) ||
      allCycles.find((c) => !c.isClosed) ||
      allCycles[allCycles.length - 1];

    // Filter transactions strictly for this cycle
    const { bills, cashTransactions, cropLogs } = filterTransactionsForCycle(
      farmer,
      targetCycle
    );

    // Run central calculation engine
    const calcResult = calculateSettlement({
      bills,
      cashTransactions,
      cropLogs,
      settlementDate: targetCycle.isClosed ? targetCycle.endDate : settlementDate,
    });

    const isAlreadySettled = targetCycle.isClosed;
    const existingSettlement = targetCycle.settlement || null;

    return NextResponse.json({
      shopInfo,
      farmer: {
        id: farmer.id,
        farmerNo: farmer.farmerNo,
        name: farmer.name,
        phone: farmer.phone,
        email: farmer.email,
        createdAt: farmer.createdAt,
      },
      cycle: {
        id: targetCycle.id,
        cycleNumber: targetCycle.cycleNumber,
        label: targetCycle.label,
        shortLabel: targetCycle.shortLabel,
        startDate: targetCycle.startDate.toISOString(),
        endDate: targetCycle.endDate.toISOString(),
        isClosed: targetCycle.isClosed,
      },
      allCycles: allCycles.map((c) => ({
        id: c.id,
        cycleNumber: c.cycleNumber,
        label: c.label,
        shortLabel: c.shortLabel,
        startDate: c.startDate.toISOString(),
        endDate: c.endDate.toISOString(),
        isClosed: c.isClosed,
        status: c.status,
        paymentStatus: c.paymentStatus,
        totalAmount: c.settlement?.totalAmount,
      })),
      settlementDate: settlementDate.toISOString(),
      status: targetCycle.status,
      paymentStatus: targetCycle.paymentStatus,
      isAlreadySettled,
      existingSettlementId: existingSettlement?.id || null,
      existingSettlement,
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
    const { settlementDate, status = "MANUALLY_SETTLED", summary } = body;

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
        annualSettlements: { orderBy: { periodEnd: "desc" } },
      },
    });

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    const actualSettlementDate = settlementDate
      ? new Date(settlementDate)
      : new Date();

    // Compute cycles
    const allCycles = getFarmerAccountingCycles(farmer, actualSettlementDate);
    const activeCycle = allCycles.find((c) => !c.isClosed);

    if (!activeCycle) {
      return NextResponse.json(
        { error: "No active accounting cycle found for this farmer." },
        { status: 400 }
      );
    }

    // Check if settlement date is before cycle start date
    if (actualSettlementDate < activeCycle.startDate) {
      return NextResponse.json(
        {
          error: `Settlement date (${format(
            actualSettlementDate,
            "dd-MMM-yyyy"
          )}) cannot be earlier than the active cycle start date (${format(
            activeCycle.startDate,
            "dd-MMM-yyyy"
          )}).`,
        },
        { status: 400 }
      );
    }

    const cycleLabel = `Cycle ${activeCycle.cycleNumber} (${format(
      activeCycle.startDate,
      "dd MMM yyyy"
    )} – ${format(actualSettlementDate, "dd MMM yyyy")})`;

    const settlement = await prisma.annualSettlement.create({
      data: {
        farmerId: farmer.id,
        periodStart: activeCycle.startDate,
        periodEnd: actualSettlementDate,
        academicYear: cycleLabel,
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

    return NextResponse.json({
      settlement,
      cycleLabel,
      needsDecision: true,
    });
  } catch (error: any) {
    console.error("Error saving annual settlement:", error);
    return NextResponse.json(
      { error: "Failed to save settlement" },
      { status: 500 }
    );
  }
}
