import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  getFarmerAccountingCycles,
  filterTransactionsForCycle,
} from "@/lib/cycleManager";
import { calculateSettlement } from "@/lib/settlementCalculator";
import { differenceInDays } from "date-fns";

export const dynamic = "force-dynamic";

/**
 * GET /api/annual-settlement/overview
 *
 * Returns summary stats & list of all farmers with their dynamic accounting cycle status.
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch all farmers for this shop with all their transactions & settlements
    const farmers = await prisma.farmer.findMany({
      where: { userId: session.user.id },
      orderBy: { farmerNo: "asc" },
      include: {
        annualSettlements: { orderBy: { periodEnd: "desc" } },
        bills: { orderBy: { date: "asc" } },
        cashTransactions: { orderBy: { date: "asc" } },
        cropLogs: { orderBy: { date: "asc" } },
      },
    });

    let activeUnsettledCount = 0;
    let totalSettlementsCompleted = 0;

    const farmerList = farmers.map((farmer) => {
      const cycles = getFarmerAccountingCycles(farmer);
      const activeCycle = cycles.find((c) => !c.isClosed) || cycles[cycles.length - 1];
      const closedCycles = cycles.filter((c) => c.isClosed);

      totalSettlementsCompleted += closedCycles.length;

      // Filter transactions for active cycle
      const { bills, cashTransactions, cropLogs } = filterTransactionsForCycle(
        farmer,
        activeCycle
      );

      const hasActiveTransactions =
        bills.length > 0 || cashTransactions.length > 0 || cropLogs.length > 0;

      if (hasActiveTransactions) {
        activeUnsettledCount++;
      }

      // Calculate active cycle balance
      const calcResult = calculateSettlement({
        bills,
        cashTransactions,
        cropLogs,
        settlementDate: new Date(),
      });

      const lastSettlement = closedCycles[closedCycles.length - 1]?.settlement || null;
      const daysActive = differenceInDays(new Date(), activeCycle.startDate);

      return {
        id: farmer.id,
        farmerNo: farmer.farmerNo,
        name: farmer.name,
        phone: farmer.phone,
        activeCycle: {
          cycleNumber: activeCycle.cycleNumber,
          startDate: activeCycle.startDate.toISOString(),
          label: activeCycle.label,
          daysActive: Math.max(0, daysActive),
          hasActiveTransactions,
          transactionsCount:
            bills.length + cashTransactions.length + cropLogs.length,
          estimatedBalance: calcResult.summary.finalAmount,
        },
        lastSettlement: lastSettlement
          ? {
              id: lastSettlement.id,
              date: lastSettlement.periodEnd,
              academicYear: lastSettlement.academicYear,
              paymentStatus: lastSettlement.paymentStatus,
              totalAmount: lastSettlement.totalAmount,
            }
          : null,
        closedCyclesCount: closedCycles.length,
      };
    });

    return NextResponse.json({
      stats: {
        totalFarmers: farmers.length,
        activeUnsettledCount,
        totalSettlementsCompleted,
      },
      farmers: farmerList,
    });
  } catch (error: any) {
    console.error("Error fetching settlement overview:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
