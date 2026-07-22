import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const { farmerId, cropLogIds, date } = await request.json();

    if (!farmerId || !cropLogIds || cropLogIds.length === 0 || !date) {
      return NextResponse.json({ error: "Missing required fields or no bills selected" }, { status: 400 });
    }

    // Find the logs to calculate the exact amount
    const logs = await prisma.cropLog.findMany({
      where: {
        id: { in: cropLogIds },
        farmerId: farmerId,
        isSettled: false
      }
    });

    if (logs.length === 0) {
      return NextResponse.json({ error: "No unsettled bills found for the provided IDs" }, { status: 400 });
    }

    const totalAmount = logs.reduce((sum, log) => sum + (log.totalWeight / 100) * (log.price || 0), 0);

    // Create settlement record and mark logs as settled
    const [settlement] = await prisma.$transaction([
      prisma.cropSettlement.create({
        data: {
          farmerId,
          amount: totalAmount,
          date: new Date(date),
        },
      }),
      prisma.cropLog.updateMany({
        where: { id: { in: logs.map(l => l.id) } },
        data: { isSettled: true }
      })
    ]);

    return NextResponse.json(settlement);
  } catch (error: any) {
    console.error("Error creating settlement:", error);
    return NextResponse.json(
      { error: "Failed to record settlement" },
      { status: 500 }
    );
  }
}
