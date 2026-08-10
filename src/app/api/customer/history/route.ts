import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const session = await getSession();

    if (!session || session.user.role !== "customer") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const farmerId = session.user.id;
    const ownerId = session.user.ownerId; // The shop owner's ID

    const farmerData = await prisma.farmer.findUnique({
      where: { 
        id: farmerId,
      },
      include: {
        bills: {
          orderBy: { date: 'desc' }
        },
        cashTransactions: {
          orderBy: { date: 'desc' }
        },
        cropLogs: {
          orderBy: { date: 'desc' }
        },
        cropSettlements: {
          orderBy: { date: 'desc' }
        }
      }
    });

    if (!farmerData) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    // Verify that the farmer actually belongs to the shop owner in the session for extra security
    if (farmerData.userId !== ownerId) {
      return NextResponse.json({ error: "Unauthorized access to farmer data" }, { status: 403 });
    }

    return NextResponse.json(farmerData);
  } catch (error) {
    console.error("Error fetching customer history:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
