import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (!query) {
      return NextResponse.json({ error: "Query parameter 'q' is required" }, { status: 400 });
    }

    const farmers = await prisma.farmer.findMany({
      where: {
        OR: [
          { id: { contains: query } },
          { name: { contains: query } },
          { phone: { contains: query } },
        ],
      },
      take: 10,
    });

    return NextResponse.json(farmers);
  } catch (error: any) {
    console.error("Error searching farmers:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
