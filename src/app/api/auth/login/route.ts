import { encrypt } from "@/lib/auth";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function POST(request: Request) {
  try {
    const body = await request.text();
    console.log('Login request raw body:', body);
    let email: string = "", password: string = "";
    try {
      const data = JSON.parse(body);
      email = data.email;
      password = data.password;
    } catch (e) {
      console.error('Failed to parse login JSON:', e);
      return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    // Create session token
    const sessionData = {
      user: {
        id: user.id,
        email: user.email,
        shopName: user.shopName,
        ownerName: user.ownerName,
      },
    };
    const token = await encrypt(sessionData);

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, shopName: user.shopName },
    });
    
    const cookieStore = await cookies();
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    
    return response;
  } catch (error: any) {
    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error: " + error?.message + " | " + error?.stack }, { status: 500 });
  }
}
