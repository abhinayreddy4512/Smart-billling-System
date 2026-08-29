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

    // Check if this academic year is already SETTLED
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

    // Process Bills - Accrues 2% simple interest
    let totalPesticides = 0;
    let totalFertilizers = 0;
    let totalBillInterest = 0;

    const processedBills = billsInPeriod.map((bill) => {
      const days = Math.max(0, differenceInDays(today, new Date(bill.date)));
      const months = days / 30;
      const interest = bill.total * INTEREST_RATE_PER_MONTH * months;

      if (bill.category === "PESTICIDE") totalPesticides += bill.total;
      else totalFertilizers += bill.total;

      totalBillInterest += interest;

      return { ...bill, type: "BILL", days, interest, finalAmount: bill.total + interest };
    });

    // Process Cash (Taken = owes money, Given = paid money)
    let totalCashTaken = 0;
    let totalCashGiven = 0;
    let totalCashInterest = 0;

    const processedCash = cashInPeriod.map((cash) => {
      const days = Math.max(0, differenceInDays(today, new Date(cash.date)));
      const months = days / 30;
      const interest = cash.amount * INTEREST_RATE_PER_MONTH * months;

      if (cash.type === "TAKEN") {
        totalCashTaken += cash.amount;
        totalCashInterest += interest;
        return { ...cash, days, interest, finalAmount: cash.amount + interest };
      } else {
        totalCashGiven += cash.amount;
        totalCashInterest -= interest;
        return { ...cash, days, interest, finalAmount: cash.amount + interest };
      }
    });

    // Process Crops (Unsettled = deduction, Settled = reference only)
    let totalUnsettledCrops = 0;
    let totalSettledCrops = 0;

    const processedCrops = cropsInPeriod.map((log) => {
      const amount = (log.totalWeight / 100) * (log.price || 0);
      if (!log.isSettled) {
        totalUnsettledCrops += amount;
      } else {
        totalSettledCrops += amount;
      }
      return { ...log, amount, days: 0, interest: 0, finalAmount: amount };
    });

    const shopPurchases = totalPesticides + totalFertilizers + totalBillInterest;
    const cashTakenTotal = totalCashTaken + (totalCashInterest > 0 ? totalCashInterest : 0);
    const cashGivenTotal = totalCashGiven;
    const netMoneyBalance = cashTakenTotal - cashGivenTotal;

    const grandTotal = existingSettlement
      ? existingSettlement.totalAmount
      : shopPurchases + netMoneyBalance - totalUnsettledCrops;

    return NextResponse.json({
      shopInfo,
      farmer,
      academicYear,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
      isSettled: !!existingSettlement,
      isReadOnly: !!existingSettlement,
      settlementRecord: existingSettlement || null,
      processedBills,
      processedCash,
      processedCrops,
      summary: {
        totalPesticides,
        totalFertilizers,
        totalPurchases: totalPesticides + totalFertilizers,
        totalBillInterest,
        shopPurchases,
        totalCashTaken,
        totalCashGiven,
        netMoneyBalance,
        totalUnsettledCrops,
        totalSettledCrops,
        totalInterest: totalBillInterest + totalCashInterest,
        grandTotal,
      },
    });
  } catch (error: any) {
    console.error("Error calculating total final:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
