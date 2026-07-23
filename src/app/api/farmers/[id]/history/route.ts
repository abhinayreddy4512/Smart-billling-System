import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await getSession();
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const farmer = await prisma.farmer.findUnique({
      where: { 
        userId_farmerNo: {
          userId: session.user.id,
          farmerNo: id.toUpperCase()
        }
      },
      include: {
        bills: {
          orderBy: { date: "desc" },
        },
        cashTransactions: {
          orderBy: { date: "desc" },
        },
        cropLogs: {
          orderBy: { date: "desc" },
        },
        cropSettlements: {
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
