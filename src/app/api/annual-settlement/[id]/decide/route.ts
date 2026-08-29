import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/annual-settlement/[id]/decide
 *
 * Handles the "Paid by Farmer" or "Carry Forward" decision after a settlement
 * has been calculated and recorded.
 *
 * Body: {
 *   settlementId: string,
 *   decision: "PAID" | "CARRY_FORWARD",
 *   finalAmount: number,   // positive = farmer owes admin, negative = admin owes farmer
 *   settlementDate: string, // ISO date string
 *   academicYear: string,  // e.g. "2025-26"
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
    const { settlementId, decision, finalAmount, settlementDate, academicYear } = body;

    if (!settlementId || !decision) {
      return NextResponse.json({ error: "settlementId and decision are required" }, { status: 400 });
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

    const actualSettlementDate = settlementDate ? new Date(settlementDate) : new Date();
    const absAmount = Math.abs(finalAmount);

    // If the balance is effectively zero, nothing to record
    const hasBalance = absAmount > 0.01;

    let generatedReceiptNo: number | null = null;
    let carryForwardReceiptNo: number | null = null;

    if (decision === "PAID") {
      // Record a payment transaction on the settlement date to clear the balance
      if (hasBalance) {
        // If farmer owed admin (positive): farmer GIVES money → GIVEN
        // If admin owed farmer (negative): admin GIVES money → GIVEN (from admin's perspective this is GIVEN, i.e., farmer received)
        const transactionType = finalAmount > 0 ? "GIVEN" : "TAKEN";
        // finalAmount > 0: farmer pays admin → admin records as receiving (GIVEN by farmer = GIVEN)
        // finalAmount < 0: admin pays farmer → admin records as giving out (admin gives = GIVEN)
        // Actually: TAKEN = money taken from farmer / borrowed by farmer; GIVEN = money given to farmer
        // Payment by farmer reduces debt: GIVEN (shop receives from farmer, cancels the debt)
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
            note: `Annual Settlement Payment — ${academicYear}`,
            photoProof: null,
          },
        });
      }

      // Update settlement record
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
        message: hasBalance
          ? `Payment of ₹${absAmount.toFixed(2)} recorded. Account settled for ${academicYear}.`
          : `Account settled with zero balance for ${academicYear}.`,
        receiptNo: generatedReceiptNo,
      });
    } else if (decision === "CARRY_FORWARD") {
      // Create an opening balance transaction on 1 June of the NEXT academic year
      // Parse academic year e.g. "2025-26" → next year start = 1 Jun 2026
      const [startYearStr] = (academicYear || "").split("-");
      const startYear = parseInt(startYearStr, 10);
      const nextYearStartDate = isNaN(startYear)
        ? new Date(actualSettlementDate.getFullYear() + 1, 5, 1) // fallback
        : new Date(startYear + 1, 5, 1); // 1 June of next year

      if (hasBalance) {
        // finalAmount > 0: farmer still owes admin → opening balance is TAKEN (farmer borrowed)
        // finalAmount < 0: admin still owes farmer → opening balance is GIVEN (admin gave credit)
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
            date: nextYearStartDate,
            note: `Carry Forward from ${academicYear}`,
            photoProof: null,
          },
        });
      }

      // Update settlement record
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
        message: hasBalance
          ? `₹${absAmount.toFixed(2)} carried forward to next year (${startYear + 1}-${String(startYear + 2).slice(2)}) as opening balance from ${nextYearStartDate.toLocaleDateString("en-IN")}.`
          : `Account settled with zero balance. Nothing to carry forward.`,
        receiptNo: carryForwardReceiptNo,
        nextYearStartDate: nextYearStartDate.toISOString(),
      });
    } else {
      return NextResponse.json({ error: "Invalid decision. Must be PAID or CARRY_FORWARD." }, { status: 400 });
    }
  } catch (error: any) {
    console.error("Error processing settlement decision:", error);
    return NextResponse.json(
      { error: "Failed to process decision" },
      { status: 500 }
    );
  }
}
