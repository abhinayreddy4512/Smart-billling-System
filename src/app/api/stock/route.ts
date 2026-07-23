import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";


export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const products = await prisma.product.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
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

    const product = await prisma.product.create({
      data: {
        userId: session.user.id,
        category,
        name,
        size: size || null,
        quantity: parseInt(quantity, 10),
        price: parseFloat(price),
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("Error adding stock:", error);
    return NextResponse.json({ error: "Failed to add stock" }, { status: 500 });
  }
}
