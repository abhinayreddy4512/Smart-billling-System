import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";



export async function GET() {
  try {
    const farmers = await prisma.farmer.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(farmers);
  } catch (error) {
    console.error("Error fetching farmers:", error);
    return NextResponse.json({ error: "Failed to fetch farmers" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, email } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and Phone are required" }, { status: 400 });
    }

    // Generate unique ID: F-001, F-002, etc.
    // In a highly concurrent environment, a transaction or sequence is better,
    // but this is a simple local app.
    const lastFarmer = await prisma.farmer.findFirst({
      orderBy: { createdAt: "desc" },
    });

    let newId = "1001";
    if (lastFarmer && lastFarmer.id.match(/^\d+$/)) {
      const lastNumber = parseInt(lastFarmer.id, 10);
      if (!isNaN(lastNumber)) {
        newId = String(lastNumber + 1);
      }
    }

    const farmer = await prisma.farmer.create({
      data: {
        id: newId,
        name,
        phone,
        email,
      },
    });

    return NextResponse.json(farmer, { status: 201 });
  } catch (error) {
    console.error("Error creating farmer:", error);
    return NextResponse.json({ error: "Failed to create farmer" }, { status: 500 });
  }
}
