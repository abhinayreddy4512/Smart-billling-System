import { NextResponse } from "next/server";
import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const INTEREST_RATE_PER_MONTH = 0.02; // 2% per month (2 rupees per 100)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const today = new Date();
    
    const session = await getSession();
    const shopInfo = session?.user || null;

    const farmer = await prisma.farmer.findUnique({
      where: { id: id.toUpperCase() },
      include: {
        bills: { orderBy: { date: "asc" } },
        cashTransactions: { orderBy: { date: "asc" } },
        cropLogs: { orderBy: { date: "asc" } },
      },
    });

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    let totalPrincipal = 0;
    let totalInterest = 0;
    
    // Process Bills (Farmer owes money)
    const processedBills = farmer.bills.map((bill) => {
      const days = Math.max(0, differenceInDays(today, new Date(bill.date)));
      const months = days / 30;
      const interest = bill.total * INTEREST_RATE_PER_MONTH * months;
      
      totalPrincipal += bill.total;
      totalInterest += interest;

      return { ...bill, type: "BILL", days, interest, finalAmount: bill.total + interest };
    });

    // Process Cash (Taken = owes money, Given = paid money)
    const processedCash = farmer.cashTransactions.map((cash) => {
      const days = Math.max(0, differenceInDays(today, new Date(cash.date)));
      const months = days / 30;
      let interest = 0;

      if (cash.type === "TAKEN") {
        interest = cash.amount * INTEREST_RATE_PER_MONTH * months;
        totalPrincipal += cash.amount;
        totalInterest += interest;
        return { ...cash, days, interest, finalAmount: cash.amount + interest };
      } else {
        // GIVEN: subtracts from the debt
        interest = cash.amount * INTEREST_RATE_PER_MONTH * months;
        totalPrincipal -= cash.amount;
        totalInterest -= interest;
        return { ...cash, days, interest: interest, finalAmount: (cash.amount + interest) };
      }
    });

    // Process Crops
    const processedCrops = farmer.cropLogs.map((log) => {
      const amount = (log.totalWeight / 100) * (log.price || 0);
      const days = Math.max(0, differenceInDays(today, new Date(log.date)));
      const months = days / 30;
      let interest = 0;
      
      if (!log.isSettled) {
        // Unsettled crops act like money GIVEN (subtracts from farmer's debt)
        interest = amount * INTEREST_RATE_PER_MONTH * months;
        totalPrincipal -= amount;
        totalInterest -= interest;
      }
      
      return { ...log, amount, days, interest, finalAmount: amount + interest };
    });

    const finalAmount = totalPrincipal + totalInterest;

    return NextResponse.json({
      shopInfo,
      farmer,
      processedBills,
      processedCash,
      processedCrops,
      summary: {
        totalPrincipal,
        totalInterest,
        finalAmount
      }
    });
  } catch (error) {
    console.error("Error calculating total:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
