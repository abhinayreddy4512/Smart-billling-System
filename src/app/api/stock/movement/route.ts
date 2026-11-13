import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getMayAprilBusinessYear } from "@/lib/academicYear";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { productId, category, productName, size, quantity, price, date, movementType, note } = body;

    const parsedQty = parseInt(quantity, 10);
    if (isNaN(parsedQty) || parsedQty <= 0) {
      return NextResponse.json({ error: "Quantity must be a positive number" }, { status: 400 });
    }

    const txDate = date ? new Date(date) : new Date();
    const businessYear = getMayAprilBusinessYear(txDate);
    const parsedPrice = price ? parseFloat(price) : 0;
    const type = movementType || "RECEIVED";

    const result = await prisma.$transaction(async (tx) => {
      let linkedProductId = productId;
      let finalCategory = category;
      let finalName = productName;
      let finalSize = size;

      if (productId) {
        const existing = await tx.product.findUnique({ where: { id: productId } });
        if (existing && existing.userId === session.user.id) {
          finalCategory = existing.category;
          finalName = existing.name;
          finalSize = existing.size;

          // If movement is RECEIVED, increment live quantity; if OPENING_BALANCE and quantity was 0, update it
          await tx.product.update({
            where: { id: productId },
            data: {
              quantity: existing.quantity + parsedQty,
              ...(parsedPrice > 0 ? { price: parsedPrice } : {}),
            },
          });
        }
      } else if (finalName && finalCategory) {
        // Find by name + category or create
        const existing = await tx.product.findFirst({
          where: {
            userId: session.user.id,
            category: finalCategory,
            name: { equals: finalName.trim(), mode: "insensitive" },
          },
        });

        if (existing) {
          linkedProductId = existing.id;
          await tx.product.update({
            where: { id: existing.id },
            data: {
              quantity: existing.quantity + parsedQty,
              ...(parsedPrice > 0 ? { price: parsedPrice } : {}),
            },
          });
        } else {
          const newProd = await tx.product.create({
            data: {
              userId: session.user.id,
              category: finalCategory,
              name: finalName.trim(),
              size: finalSize?.trim() || null,
              quantity: parsedQty,
              price: parsedPrice,
            },
          });
          linkedProductId = newProd.id;
        }
      }

      const movement = await tx.stockMovement.create({
        data: {
          userId: session.user.id,
          productId: linkedProductId || null,
          category: finalCategory,
          productName: finalName.trim(),
          size: finalSize?.trim() || null,
          movementType: type,
          quantity: parsedQty,
          price: parsedPrice,
          date: txDate,
          businessYear,
          note: note || `Stock ${type.toLowerCase()} entry`,
        },
      });

      return movement;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error: any) {
    console.error("Error recording stock movement:", error);
    return NextResponse.json(
      { error: error.message || "Failed to record stock movement" },
      { status: 500 }
    );
  }
}
