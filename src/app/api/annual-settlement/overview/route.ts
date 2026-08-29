import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAcademicYearFromDate, getAcademicYearRange } from "@/lib/academicYear";

export const dynamic = "force-dynamic";

/**
 * GET /api/annual-settlement/overview?academicYear=2026-27
 *
 * Returns summary stats & list of all farmers with their settlement status
 * for the specified academic year.
 */
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const requestedAY = searchParams.get("academicYear") || getAcademicYearFromDate();
    const { startDate, endDate } = getAcademicYearRange(requestedAY);

    // Fetch all farmers for this shop
    const farmers = await prisma.farmer.findMany({
      where: { userId: session.user.id },
      orderBy: { farmerNo: "asc" },
      include: {
        annualSettlements: {
          where: { academicYear: requestedAY },
        },
        bills: {
          where: {
            date: { gte: startDate, lte: endDate },
          },
        },
        cashTransactions: {
          where: {
            date: { gte: startDate, lte: endDate },
          },
        },
        cropLogs: {
          where: {
            date: { gte: startDate, lte: endDate },
          },
        },
      },
    });

    let settledCount = 0;
    let unsettledCount = 0;

    const farmerList = farmers.map((farmer) => {
      const settlement = farmer.annualSettlements[0] || null;
      const isSettled = !!settlement;

      if (isSettled) {
        settledCount++;
      } else {
        unsettledCount++;
      }

      // Estimate balance for unsettled farmers
      let estimatedBalance = 0;
      if (!isSettled) {
        const totalBills = farmer.bills.reduce((sum, b) => sum + b.total, 0);
        const cashTaken = farmer.cashTransactions.filter((c) => c.type === "TAKEN").reduce((sum, c) => sum + c.amount, 0);
        const cashGiven = farmer.cashTransactions.filter((c) => c.type === "GIVEN").reduce((sum, c) => sum + c.amount, 0);
        const unsettledCrops = farmer.cropLogs.filter((c) => !c.isSettled).reduce((sum, c) => sum + (c.totalWeight / 100) * (c.price || 0), 0);

        // Liabilities (Bills + Cash Taken) - Deductions (Cash Given + Unsettled Crops)
        estimatedBalance = totalBills + cashTaken - cashGiven - unsettledCrops;
      }

      return {
        id: farmer.id,
        farmerNo: farmer.farmerNo,
        name: farmer.name,
        phone: farmer.phone,
        isSettled,
        status: isSettled ? settlement.status : "UNSETTLED",
        paymentStatus: isSettled ? settlement.paymentStatus : "PENDING",
        settlementDate: isSettled ? settlement.periodEnd : null,
        finalAmount: isSettled ? settlement.totalAmount : estimatedBalance,
        settlementId: isSettled ? settlement.id : null,
      };
    });

    return NextResponse.json({
      academicYear: requestedAY,
      stats: {
        totalFarmers: farmers.length,
        settledCount,
        unsettledCount,
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
