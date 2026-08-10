import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { customerLogin } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const { phone, farmerNo } = await request.json();

    if (!phone || !farmerNo) {
      return NextResponse.json({ error: "Phone number and Farmer ID are required" }, { status: 400 });
    }

    const farmers = await prisma.farmer.findMany({
      where: {
        phone: phone,
        farmerNo: farmerNo,
      },
      include: {
        user: true, 
      }
    });

    if (farmers.length === 0) {
      return NextResponse.json({ error: "Invalid phone number or unique customer ID. Please check your details and try again." }, { status: 401 });
    }

    const farmer = farmers[0];
    const shopOwner = farmer.user;

    await customerLogin(farmer, shopOwner);

    return NextResponse.json({ success: true, shopName: shopOwner.shopName }, { status: 200 });
  } catch (error: any) {
    console.error("Customer login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
