import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";


export async function GET() {
  try {
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const farmers = await prisma.farmer.findMany({
      where: { userId: session.user.id },
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
    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { name, phone, email } = body;

    if (!name || !phone) {
      return NextResponse.json({ error: "Name and Phone are required" }, { status: 400 });
    }

    const lastFarmer = await prisma.farmer.findFirst({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
    });

    let newFarmerNo = "1001";
    if (lastFarmer && lastFarmer.farmerNo.match(/^\d+$/)) {
      const lastNumber = parseInt(lastFarmer.farmerNo, 10);
      if (!isNaN(lastNumber)) {
        newFarmerNo = String(lastNumber + 1);
      }
    }

    const farmer = await prisma.farmer.create({
      data: {
        farmerNo: newFarmerNo,
        userId: session.user.id,
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
