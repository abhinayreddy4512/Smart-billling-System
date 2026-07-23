import { NextResponse } from "next/server";
import { encrypt } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST(request: Request) {
  try {
    // Get session to identify the user
    const session = await getSession(request);
    if (!session || !session.user?.id) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const {
      shopName,
      ownerName,
      phone,
      gstNo,
      village,
      mandal,
      district,
      state,
    } = await request.json();

    // Basic validation
    if (!shopName || !ownerName || !phone) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        shopName,
        ownerName,
        phone,
        gstNo,
        village,
        mandal,
        district,
        state,
      },
    });

    // Refresh the session cookie so that the client now sees shopName
    // (the session already contains the same data, but we re‑issue it for safety)
    const updatedSession = {
      user: {
        id: session.user.id,
        email: session.user.email,
        shopName,
        ownerName,
      },
    };
    const token = await encrypt(updatedSession);
    const response = NextResponse.json({ success: true });
    
    const cookieStore = await cookies();
    cookieStore.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60,
      path: "/",
    });
    
    return response;
  } catch (err: any) {
    console.error("Onboarding error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
