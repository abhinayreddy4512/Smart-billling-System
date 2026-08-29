import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getAcademicYearRange } from "@/lib/academicYear";

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

    const { searchParams } = new URL(request.url);
    const requestedAY = searchParams.get("academicYear") || "ALL";

    let dateFilter: { gte?: Date; lte?: Date } | undefined = undefined;
    if (requestedAY !== "ALL") {
      const { startDate, endDate } = getAcademicYearRange(requestedAY);
      dateFilter = { gte: startDate, lte: endDate };
    }

    const farmer = await prisma.farmer.findUnique({
      where: {
        userId_farmerNo: {
          userId: session.user.id,
          farmerNo: id.toUpperCase(),
        },
      },
      include: {
        bills: {
          where: dateFilter ? { date: dateFilter } : undefined,
          orderBy: { date: "desc" },
        },
        cashTransactions: {
          where: dateFilter ? { date: dateFilter } : undefined,
          orderBy: { date: "desc" },
        },
        cropLogs: {
          where: dateFilter ? { date: dateFilter } : undefined,
          orderBy: { date: "desc" },
        },
        cropSettlements: {
          where: dateFilter ? { date: dateFilter } : undefined,
          orderBy: { date: "desc" },
        },
        annualSettlements: {
          where: requestedAY !== "ALL" ? { academicYear: requestedAY } : undefined,
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!farmer) {
      return NextResponse.json({ error: "Farmer not found" }, { status: 404 });
    }

    return NextResponse.json({
      ...farmer,
      academicYear: requestedAY,
    });
  } catch (error) {
    console.error("Error fetching farmer history:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
