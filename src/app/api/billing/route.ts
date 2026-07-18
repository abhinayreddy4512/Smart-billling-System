import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";



export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { farmerId, photoProof, items } = body;

    if (!farmerId || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Missing required fields or items" }, { status: 400 });
    }

    // Use a transaction to ensure all bills and stock deductions succeed
    const result = await prisma.$transaction(async (tx) => {
      const createdBills = [];

      for (const item of items) {
        const { productId, quantity, customPrice } = item;
        const qty = parseInt(quantity, 10);
        const price = parseFloat(customPrice);

        if (qty <= 0) {
          throw new Error("Quantity must be greater than zero");
        }

        // 1. Fetch Product
        const product = await tx.product.findUnique({ where: { id: productId } });
        if (!product) throw new Error(`Product not found (ID: ${productId})`);
        
        if (product.quantity < qty) {
          throw new Error(`Insufficient stock for ${product.name}. Only ${product.quantity} left.`);
        }

        // 2. Deduct Stock
        await tx.product.update({
          where: { id: productId },
          data: { quantity: product.quantity - qty },
        });

        // 3. Create Bill Record
        const productNameWithSize = product.size ? `${product.name} (${product.size})` : product.name;
        
        const bill = await tx.bill.create({
          data: {
            farmerId: farmerId.toUpperCase(),
            category: product.category,
            product: productNameWithSize,
            quantity: qty,
            price: price,
            total: price * qty,
            photoProof: photoProof, // Base64 image saved for each row
          },
        });
        createdBills.push(bill);
      }

      return createdBills;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error creating bill:", error);
    return NextResponse.json({ error: error.message || "Failed to process billing" }, { status: 500 });
  }
}
