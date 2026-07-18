import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";



export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { farmerId, type, amount, photoProof } = body;

    if (!farmerId || !type || !amount) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const numericAmount = parseFloat(amount);
    if (numericAmount <= 0) {
      return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
    }

    // Verify farmer exists
    const farmer = await prisma.farmer.findUnique({ where: { id: farmerId.toUpperCase() } });
    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    const transaction = await prisma.cashTransaction.create({
      data: {
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
