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
    const requestedAYParam = searchParams.get("academicYear");
    const customSettlementDateStr = searchParams.get("settlementDate");

    const today = customSettlementDateStr ? new Date(customSettlementDateStr) : new Date();
    const academicYear = requestedAYParam || getAcademicYearFromDate(today);
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

    // Filter transactions strictly within the academic year window
    const billsInPeriod = farmer.bills.filter(
      (b) => new Date(b.date) >= periodStart && new Date(b.date) <= today
    );

    const cashInPeriod = farmer.cashTransactions.filter(
      (c) => new Date(c.date) >= periodStart && new Date(c.date) <= today
    );

    const cropsInPeriod = farmer.cropLogs.filter(
      (c) => new Date(c.date) >= periodStart && new Date(c.date) <= today
    );

    // Call central calculation engine (EXACT same as Annual Settlement)
    const calcResult = calculateSettlement({
      bills: billsInPeriod,
      cashTransactions: cashInPeriod,
      cropLogs: cropsInPeriod,
      settlementDate: today,
    });

    return NextResponse.json({
      shopInfo,
      farmer,
      academicYear,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      isSettled: !!existingSettlement,
      isReadOnly: !!existingSettlement,
      settlementRecord: existingSettlement || null,
      ...calcResult,
    });
  } catch (error: any) {
    console.error("Error calculating total final:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
