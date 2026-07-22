import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    
    // Fetch crop logs (Cotton & Mirchi history)
    const cropLogs = await prisma.cropLog.findMany({
      where: { farmerId: id },
      orderBy: { date: 'desc' },
    });

    // Fetch settlements history
    const settlements = await prisma.cropSettlement.findMany({
      where: { farmerId: id },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ cropLogs, settlements });
  } catch (error: any) {
    console.error("Error fetching farmer settlement data:", error);
    return NextResponse.json(
      { error: "Failed to fetch settlement data" },
      { status: 500 }
    );
  }
}
