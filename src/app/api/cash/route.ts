import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";


export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { farmerId, type, amount, photoProof } = body;

    if (!farmerId || !type || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const numericAmount = parseFloat(amount);
    if (numericAmount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }

    // Verify farmer exists and belongs to current user
    const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
    if (!farmer || farmer.userId !== session.user.id) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    const lastTransaction = await prisma.cashTransaction.findFirst({
      where: { farmer: { userId: session.user.id } },
      orderBy: { receiptNo: "desc" },
    });
    const nextReceiptNo = lastTransaction?.receiptNo ? lastTransaction.receiptNo + 1 : 1;

    const transaction = await prisma.cashTransaction.create({
      data: {
        receiptNo: nextReceiptNo,
        farmerId: farmer.id,
        type: type, // 'TAKEN' or 'GIVEN'
        amount: numericAmount,
        photoProof: photoProof, // Base64 image
      },
    });

    return NextResponse.json(transaction, { status: 201 });
  } catch (error: any) {
    console.error("Error creating cash transaction:", error);
    return NextResponse.json({ error: "Failed to process cash transaction" }, { status: 500 });
  }
}
