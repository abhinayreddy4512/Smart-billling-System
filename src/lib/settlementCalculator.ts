import { differenceInDays } from "date-fns";

const INTEREST_RATE_PER_MONTH = 0.02; // 2% per month simple interest (₹2 per ₹100/month)

export interface CalculationInput {
  bills: any[];
  cashTransactions: any[];
  cropLogs: any[];
  settlementDate: Date;
}

export function calculateSettlement({
  bills,
  cashTransactions,
  cropLogs,
  settlementDate,
}: CalculationInput) {
  // 1. PESTICIDES (Purchases)
  let pesticidesPrincipal = 0;
  let pesticidesInterest = 0;
  const pesticides = bills
    .filter((b) => b.category === "PESTICIDE")
    .map((bill) => {
      const days = Math.max(0, differenceInDays(settlementDate, new Date(bill.date)));
      const months = days / 30;
      const interest = bill.total * INTEREST_RATE_PER_MONTH * months;
      pesticidesPrincipal += bill.total;
      pesticidesInterest += interest;
      return { ...bill, days, interest, finalAmount: bill.total + interest };
    });

  // 2. FERTILIZERS (Purchases)
  let fertilizersPrincipal = 0;
  let fertilizersInterest = 0;
  const fertilizers = bills
    .filter((b) => b.category === "FERTILIZER")
    .map((bill) => {
      const days = Math.max(0, differenceInDays(settlementDate, new Date(bill.date)));
      const months = days / 30;
      const interest = bill.total * INTEREST_RATE_PER_MONTH * months;
      fertilizersPrincipal += bill.total;
      fertilizersInterest += interest;
      return { ...bill, days, interest, finalAmount: bill.total + interest };
    });

  // 3. MONEY TAKEN (Loans Borrowed)
  let cashTakenPrincipal = 0;
  let cashTakenInterest = 0;
  const moneyTaken = cashTransactions
    .filter((c) => c.type === "TAKEN")
    .map((cash) => {
      const days = Math.max(0, differenceInDays(settlementDate, new Date(cash.date)));
      const months = days / 30;
      const interest = cash.amount * INTEREST_RATE_PER_MONTH * months;
      cashTakenPrincipal += cash.amount;
      cashTakenInterest += interest;
      return { ...cash, days, interest, finalAmount: cash.amount + interest };
    });

  // 4. CASH REPAYMENTS (Money Given by Cash)
  let cashGivenPrincipal = 0;
  let cashGivenInterest = 0;
  const loanRepayments = cashTransactions
    .filter((c) => c.type === "GIVEN")
    .map((cash) => {
      const days = Math.max(0, differenceInDays(settlementDate, new Date(cash.date)));
      const months = days / 30;
      const interest = cash.amount * INTEREST_RATE_PER_MONTH * months;
      cashGivenPrincipal += cash.amount;
      cashGivenInterest += interest;
      return { ...cash, days, interest, finalAmount: cash.amount + interest };
    });

  // 5. CROPS (Unsettled = Loan Repayment with 0% interest, Settled = Reference only)
  let unsettledCotton = 0;
  let unsettledMirchi = 0;
  let settledCotton = 0;
  let settledMirchi = 0;

  const unsettledCrops = cropLogs
    .filter((c) => !c.isSettled)
    .map((log) => {
      const amount = (log.totalWeight / 100) * (log.price || 0);
      if (log.cropType === "COTTON") unsettledCotton += amount;
      else unsettledMirchi += amount;
      return { ...log, amount, interest: 0, finalAmount: amount };
    });

  const settledCropsForRecord = cropLogs
    .filter((c) => c.isSettled)
    .map((log) => {
      const amount = (log.totalWeight / 100) * (log.price || 0);
      if (log.cropType === "COTTON") settledCotton += amount;
      else settledMirchi += amount;
      return { ...log, amount, interest: 0, finalAmount: 0 };
    });

  const unsettledCropsTotal = unsettledCotton + unsettledMirchi;
  const settledCropsTotal = settledCotton + settledMirchi;

  // 6. TOTAL CALCULATIONS
  const pesticidesTotal = pesticidesPrincipal + pesticidesInterest;
  const fertilizersTotal = fertilizersPrincipal + fertilizersInterest;
  const shopPurchasesTotal = pesticidesTotal + fertilizersTotal;
  const cashTakenTotal = cashTakenPrincipal + cashTakenInterest;

  // Total Liabilities = Shop Purchases + Money Taken
  const totalLiabilities = shopPurchasesTotal + cashTakenTotal;

  // Total Loan Repayments (Money Given) = Cash Repayments + Unsettled Crops
  const cashGivenTotal = cashGivenPrincipal + cashGivenInterest;
  const totalLoanRepayments = cashGivenTotal + unsettledCropsTotal;

  // Final Net Amount = Total Liabilities - Total Loan Repayments
  // Positive -> Farmer owes Admin
  // Negative -> Admin owes Farmer
  const finalAmount = totalLiabilities - totalLoanRepayments;

  return {
    pesticides,
    fertilizers,
    moneyTaken,
    loanRepayments,
    unsettledCrops,
    settledCropsForRecord,
    summary: {
      pesticidesPrincipal,
      pesticidesInterest,
      pesticidesTotal,
      fertilizersPrincipal,
      fertilizersInterest,
      fertilizersTotal,
      shopPurchasesTotal,
      cashTakenPrincipal,
      cashTakenInterest,
      cashTakenTotal,
      totalLiabilities,
      cashGivenPrincipal,
      cashGivenInterest,
      cashGivenTotal,
      unsettledCotton,
      unsettledMirchi,
      unsettledCropsTotal,
      totalLoanRepayments,
      settledCotton,
      settledMirchi,
      settledCropsTotal,
      totalInterest:
        pesticidesInterest +
        fertilizersInterest +
        cashTakenInterest -
        cashGivenInterest,
      finalAmount,
    },
  };
}
