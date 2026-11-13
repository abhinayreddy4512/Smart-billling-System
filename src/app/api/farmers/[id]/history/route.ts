import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
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

    const { searchParams } = new URL(request.url);
    const requestedCycleId = searchParams.get("cycleId") || "ALL";

    const farmer = await prisma.farmer.findUnique({
      where: {
        userId_farmerNo: {
          userId: session.user.id,
          farmerNo: id.toUpperCase(),
        },
      },
      include: {
        bills: { orderBy: { date: "desc" } },
        cashTransactions: { orderBy: { date: "desc" } },
        cropLogs: { orderBy: { date: "desc" } },
        cropSettlements: { orderBy: { date: "desc" } },
        annualSettlements: { orderBy: { periodEnd: "desc" } },
      },
    });

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    // Compute cycles
    const allCycles = getFarmerAccountingCycles(farmer);

    let filteredBills = farmer.bills;
    let filteredCash = farmer.cashTransactions;
    let filteredCrops = farmer.cropLogs;
    let filteredSettlements = farmer.annualSettlements;

    if (requestedCycleId !== "ALL") {
      const selectedCycle = allCycles.find((c) => c.id === requestedCycleId);
      if (selectedCycle) {
        const { bills, cashTransactions, cropLogs } = filterTransactionsForCycle(
          farmer,
          selectedCycle
        );
        filteredBills = bills;
        filteredCash = cashTransactions;
        filteredCrops = cropLogs;
        filteredSettlements = selectedCycle.isClosed
          ? farmer.annualSettlements.filter((s) => s.id === selectedCycle.id)
          : [];
      }
    }

    return NextResponse.json({
      ...farmer,
      bills: filteredBills,
      cashTransactions: filteredCash,
      cropLogs: filteredCrops,
      annualSettlements: filteredSettlements,
      selectedCycleId: requestedCycleId,
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
      })),
    });
  } catch (error) {
    console.error("Error fetching farmer history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
