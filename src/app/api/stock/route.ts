import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getMayAprilBusinessYear } from "@/lib/academicYear";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(products);
  } catch (error) {
    console.error("Error fetching stock:", error);
    return NextResponse.json({ error: "Failed to fetch stock" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { category, name, size, quantity, price } = body;

    if (!category || !name || quantity === undefined || price === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const parsedQty = parseInt(quantity, 10);
    const parsedPrice = parseFloat(price);
    const businessYear = getMayAprilBusinessYear(new Date());

    // Create product and corresponding stock movement
    const product = await prisma.$transaction(async (tx) => {
      const p = await tx.product.create({
        data: {
          userId: session.user.id,
          category,
          name: name.trim(),
          size: size?.trim() || null,
          quantity: parsedQty,
          price: parsedPrice,
        },
      });

      // Record initial stock receipt / opening balance
      await tx.stockMovement.create({
        data: {
          userId: session.user.id,
          productId: p.id,
          category,
          productName: p.name,
          size: p.size,
          movementType: "RECEIVED",
          quantity: parsedQty,
          price: parsedPrice,
          businessYear,
          note: "Initial Product Stock Entry",
        },
      });

      return p;
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error adding stock:", error);
    return NextResponse.json({ error: "Failed to add stock" }, { status: 500 });
  }
}
