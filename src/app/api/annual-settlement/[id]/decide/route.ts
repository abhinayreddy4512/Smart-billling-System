import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { addDays, startOfDay, format } from "date-fns";

export const dynamic = "force-dynamic";

/**
 * POST /api/annual-settlement/[id]/decide
 *
 * Handles the "Paid by Farmer" or "Carry Forward" decision after an annual settlement
 * has been recorded.
 *
 * Body: {
 *   settlementId: string,
 *   decision: "PAID" | "CARRY_FORWARD",
 *   finalAmount: number,    // positive = farmer owes admin, negative = admin owes farmer
 *   settlementDate: string, // ISO date string
 * }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { settlementId, decision, finalAmount, settlementDate } = body;

    if (!settlementId || !decision) {
      return NextResponse.json(
        { error: "settlementId and decision are required" },
        { status: 400 }
      );
    }

    const farmer = await prisma.farmer.findUnique({
      where: {
        userId_farmerNo: {
          userId: session.user.id,
          farmerNo: id.toUpperCase(),
        },
      },
    });

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    const settlement = await prisma.annualSettlement.findUnique({
      where: { id: settlementId },
    });

    if (!settlement) {
      return NextResponse.json(
        { error: "Settlement record not found" },
        { status: 404 }
      );
    }

    if (settlement.paymentStatus !== "PENDING_DECISION") {
      return NextResponse.json(
        {
          error: `This settlement has already been processed as ${settlement.paymentStatus}. Duplicate decisions are prevented.`,
        },
        { status: 400 }
      );
    }

    const actualSettlementDate = settlementDate
      ? new Date(settlementDate)
      : new Date(settlement.periodEnd);
    const absAmount = Math.abs(finalAmount);

    let generatedReceiptNo: number | null = null;
    let carryForwardReceiptNo: number | null = null;

    if (decision === "PAID") {
      // Record payment on settlement date
      const paymentType = finalAmount > 0 ? "GIVEN" : "TAKEN";

      const lastCash = await prisma.cashTransaction.findFirst({
        where: { farmerId: farmer.id },
        orderBy: { receiptNo: "desc" },
      });
      generatedReceiptNo = (lastCash?.receiptNo || 0) + 1;

      await prisma.cashTransaction.create({
        data: {
          receiptNo: generatedReceiptNo,
          farmerId: farmer.id,
          type: paymentType,
          amount: absAmount,
          date: actualSettlementDate,
          note: `Annual Settlement Payment (Paid in Full) [Ref: ${settlementId}]`,
          photoProof: null,
        },
      });

      await prisma.annualSettlement.update({
        where: { id: settlementId },
        data: {
          paymentStatus: "PAID",
          generatedReceiptNo,
        },
      });

      return NextResponse.json({
        success: true,
        action: "PAID",
        message:
          absAmount > 0.01
            ? `Payment of ₹${absAmount.toFixed(
                2
              )} recorded. Accounting cycle is now closed and fully settled.`
            : `Accounting cycle settled with zero balance. Settlement closed successfully.`,
        receiptNo: generatedReceiptNo,
      });
    } else if (decision === "CARRY_FORWARD") {
      // Transfer balance to next cycle starting on the DAY AFTER settlement date
      const dayAfterSettlement = startOfDay(addDays(actualSettlementDate, 1));
      const carryType = finalAmount > 0 ? "TAKEN" : "GIVEN";

      const lastCash = await prisma.cashTransaction.findFirst({
        where: { farmerId: farmer.id },
        orderBy: { receiptNo: "desc" },
      });
      carryForwardReceiptNo = (lastCash?.receiptNo || 0) + 1;

      await prisma.cashTransaction.create({
        data: {
          receiptNo: carryForwardReceiptNo,
          farmerId: farmer.id,
          type: carryType,
          amount: absAmount,
          date: dayAfterSettlement,
          note: `Opening Balance — Carried Forward from Previous Cycle [Ref: ${settlementId}] (Settled on ${format(
            actualSettlementDate,
            "dd-MMM-yyyy"
          )})`,
          photoProof: null,
        },
      });

      await prisma.annualSettlement.update({
        where: { id: settlementId },
        data: {
          paymentStatus: "CARRIED_FORWARD",
          carryForwardReceiptNo,
        },
      });

      return NextResponse.json({
        success: true,
        action: "CARRY_FORWARD",
        message: `₹${absAmount.toFixed(
          2
        )} carried forward to the next accounting cycle starting on ${format(
          dayAfterSettlement,
          "dd-MMM-yyyy"
        )} as an Opening Balance transaction.`,
        receiptNo: carryForwardReceiptNo,
        nextCycleStartDate: dayAfterSettlement.toISOString(),
      });
    } else {
      return NextResponse.json(
        { error: "Invalid decision. Must be PAID or CARRY_FORWARD." },
        { status: 400 }
      );
    }
  } catch (error: any) {
    console.error("Error processing settlement decision:", error);
    return NextResponse.json(
      { error: "Failed to process decision" },
      { status: 500 }
    );
  }
}
