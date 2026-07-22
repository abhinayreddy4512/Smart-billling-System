import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";



export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { farmerId, cropType, bagWeights, price, date } = body;

    if (!farmerId || !cropType || !Array.isArray(bagWeights) || price === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify farmer exists
    const farmer = await prisma.farmer.findUnique({ where: { id: farmerId.toUpperCase() } });
    if (!farmer) {
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
