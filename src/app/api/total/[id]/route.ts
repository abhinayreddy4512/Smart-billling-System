import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { calculateSettlement } from "@/lib/settlementCalculator";
import {
  getFarmerAccountingCycles,
  filterTransactionsForCycle,
} from "@/lib/cycleManager";

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
    const requestedCycleId = searchParams.get("cycleId") || "active";
    const customSettlementDateStr = searchParams.get("settlementDate");

    const today = customSettlementDateStr
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

    // Compute cycles dynamically
    const allCycles = getFarmerAccountingCycles(farmer, today);

    // Pick requested cycle or active cycle
    const targetCycle =
      allCycles.find((c) => c.id === requestedCycleId) ||
      allCycles.find((c) => !c.isClosed) ||
      allCycles[allCycles.length - 1];

    // Filter transactions strictly for this cycle
    const { bills, cashTransactions, cropLogs } = filterTransactionsForCycle(
      farmer,
      targetCycle
    );

    // Call central calculation engine
    const calcResult = calculateSettlement({
      bills,
      cashTransactions,
      cropLogs,
      settlementDate: targetCycle.isClosed ? targetCycle.endDate : today,
    });

    return NextResponse.json({
      shopInfo,
      farmer,
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
      isSettled: targetCycle.isClosed,
      isReadOnly: targetCycle.isClosed,
      settlementRecord: targetCycle.settlement || null,
      ...calcResult,
    });
  } catch (error: any) {
    console.error("Error calculating total final:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
