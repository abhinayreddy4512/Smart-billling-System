import { NextResponse } from "next/server";
import { differenceInDays } from "date-fns";
import { prisma } from "@/lib/prisma";

const INTEREST_RATE_PER_MONTH = 0.02; // 2% per month (2 rupees per 100)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const today = new Date();

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
      const days = differenceInDays(today, new Date(bill.date));
      const months = days / 30;
      const interest = bill.total * INTEREST_RATE_PER_MONTH * months;
      
      totalPrincipal += bill.total;
      totalInterest += interest;

      return { ...bill, type: "BILL", days, interest, finalAmount: bill.total + interest };
    });

    // Process Cash (Taken = owes money, Given = paid money)
    const processedCash = farmer.cashTransactions.map((cash) => {
      const days = differenceInDays(today, new Date(cash.date));
      const months = days / 30;
      let interest = 0;

      if (cash.type === "TAKEN") {
        interest = cash.amount * INTEREST_RATE_PER_MONTH * months;
        totalPrincipal += cash.amount;
        totalInterest += interest;
        return { ...cash, days, interest, finalAmount: cash.amount + interest };
      } else {
        // GIVEN: subtracts from the debt, usually interest is calculated against the balance,
        // but for simplicity, we calculate the interest earned on the deposit and subtract it.
        interest = cash.amount * INTEREST_RATE_PER_MONTH * months;
        totalPrincipal -= cash.amount;
        totalInterest -= interest;
        return { ...cash, days, interest: -interest, finalAmount: -(cash.amount + interest) };
      }
    });

    const finalAmount = totalPrincipal + totalInterest;

    return NextResponse.json({
      farmer,
      processedBills,
      processedCash,
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
