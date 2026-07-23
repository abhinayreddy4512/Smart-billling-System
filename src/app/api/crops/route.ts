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
    const { farmerId, cropType, bagWeights, price, date } = body;

    if (!farmerId || !cropType || !Array.isArray(bagWeights) || price === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify farmer exists and belongs to current user
    const farmer = await prisma.farmer.findUnique({ where: { id: farmerId } });
    if (!farmer || farmer.userId !== session.user.id) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    const totalWeight = bagWeights.reduce((sum, weight) => sum + (parseFloat(weight) || 0), 0);

    const cropLog = await prisma.cropLog.create({
      data: {
        farmerId: farmer.id,
        cropType,
        bagWeights,
        totalWeight,
        price: parseFloat(price),
        ...(date && { date: new Date(date) }),
      },
    });

    return NextResponse.json(cropLog, { status: 201 });
  } catch (error: any) {
    console.error("Error creating crop log:", error);
    return NextResponse.json({ error: "Failed to process crop log" }, { status: 500 });
  }
}
