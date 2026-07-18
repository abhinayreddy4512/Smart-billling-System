import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const farmer = await prisma.farmer.findUnique({
      where: { id },
      include: {
        bills: {
          orderBy: { date: "desc" },
        },
      },
    });

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    return NextResponse.json(farmer);
  } catch (error) {
    console.error("Error fetching farmer history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
