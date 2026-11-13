import { format, addDays, startOfDay, endOfDay } from "date-fns";

export interface AccountingCycle {
  id: string; // "active" or settlement.id
  cycleNumber: number;
  label: string; // e.g. "Current Active Cycle (from 16-Jan-2027)" or "Cycle 1 (12-May-2026 to 15-Jan-2027)"
  shortLabel: string; // e.g. "Active Cycle" or "Cycle 1"
  startDate: Date;
  endDate: Date;
  isClosed: boolean;
  status: "ACTIVE" | "MANUALLY_SETTLED" | "AUTOMATICALLY_SETTLED";
  paymentStatus: "PENDING_DECISION" | "PAID" | "CARRIED_FORWARD" | "NONE";
  settlement?: any;
}

/**
 * Reconstructs all accounting cycles for a farmer dynamically.
 * Cycle 1 starts on the date of the farmer's first transaction.
 * Each subsequent cycle starts on the day after the previous settlement date.
 * The active cycle runs up to the custom settlement date (or today).
 */
export function getFarmerAccountingCycles(
  farmer: {
    createdAt: Date | string;
    bills?: { date: Date | string }[];
    cashTransactions?: { date: Date | string }[];
    cropLogs?: { date: Date | string }[];
    annualSettlements?: any[];
  },
  customSettlementDate?: Date
): AccountingCycle[] {
  // Sort settlements chronologically by periodEnd
  const settlements = [...(farmer.annualSettlements || [])].sort(
    (a, b) => new Date(a.periodEnd).getTime() - new Date(b.periodEnd).getTime()
  );

  const cycles: AccountingCycle[] = [];

  // Determine earliest transaction date across all records
  const allDates: number[] = [];
  farmer.bills?.forEach((b) => allDates.push(new Date(b.date).getTime()));
  farmer.cashTransactions?.forEach((c) => allDates.push(new Date(c.date).getTime()));
  farmer.cropLogs?.forEach((c) => allDates.push(new Date(c.date).getTime()));

  let earliestTxDate: Date;
  if (allDates.length > 0) {
    earliestTxDate = startOfDay(new Date(Math.min(...allDates)));
  } else {
    earliestTxDate = startOfDay(new Date(farmer.createdAt));
  }

  // 1. Reconstruct all closed cycles from annualSettlements
  let previousEnd: Date | null = null;

  settlements.forEach((s, idx) => {
    const cycleNumber = idx + 1;
    const cycleStart = previousEnd
      ? startOfDay(addDays(new Date(previousEnd), 1))
      : s.periodStart
      ? startOfDay(new Date(s.periodStart))
      : earliestTxDate;
    const cycleEnd = endOfDay(new Date(s.periodEnd));
    previousEnd = new Date(s.periodEnd);

    cycles.push({
      id: s.id,
      cycleNumber,
      label: `Cycle ${cycleNumber} (${format(cycleStart, "dd MMM yyyy")} – ${format(new Date(s.periodEnd), "dd MMM yyyy")})`,
      shortLabel: `Cycle ${cycleNumber}`,
      startDate: cycleStart,
      endDate: cycleEnd,
      isClosed: true,
      status: s.status,
      paymentStatus: s.paymentStatus,
      settlement: s,
    });
  });

  // 2. Active Cycle (runs from day after last settlement up to customSettlementDate or today)
  const activeCycleNumber = settlements.length + 1;
  const activeStart = previousEnd
    ? startOfDay(addDays(new Date(previousEnd), 1))
    : earliestTxDate;
  const activeEnd = customSettlementDate ? endOfDay(new Date(customSettlementDate)) : endOfDay(new Date());

  cycles.push({
    id: "active",
    cycleNumber: activeCycleNumber,
    label: `Active Cycle (from ${format(activeStart, "dd MMM yyyy")})`,
    shortLabel: `Active Cycle ${activeCycleNumber}`,
    startDate: activeStart,
    endDate: activeEnd,
    isClosed: false,
    status: "ACTIVE",
    paymentStatus: "NONE",
  });

  return cycles;
}

/**
 * Filters farmer transactions strictly within a specific accounting cycle.
 */
export function filterTransactionsForCycle(
  farmer: {
    bills?: any[];
    cashTransactions?: any[];
    cropLogs?: any[];
  },
  cycle: AccountingCycle
) {
  const start = cycle.startDate.getTime();
  const end = cycle.endDate.getTime();

  const bills = (farmer.bills || []).filter((b) => {
    const t = new Date(b.date).getTime();
    return t >= start && t <= end;
  });

  const cashTransactions = (farmer.cashTransactions || []).filter((c) => {
    const t = new Date(c.date).getTime();
    return t >= start && t <= end;
  });

  const cropLogs = (farmer.cropLogs || []).filter((c) => {
    const t = new Date(c.date).getTime();
    return t >= start && t <= end;
  });

  return { bills, cashTransactions, cropLogs };
}
