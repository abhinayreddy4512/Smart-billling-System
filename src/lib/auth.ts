import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

const secretKey = "smart-billing-secret-key-replace-in-production";
const key = new TextEncoder().encode(secretKey);

export async function encrypt(payload: any) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h") // Expire token after 24 hours just as a fallback
    .sign(key);
}

export async function decrypt(input: string): Promise<any> {
  const { payload } = await jwtVerify(input, key, {
    algorithms: ["HS256"],
  });
  return payload;
}

export async function login(user: any) {
  const sessionData = { 
    user: {
      id: user.id,
      email: user.email,
      shopName: user.shopName,
      ownerName: user.ownerName,
    } 
  };
  const session = await encrypt(sessionData);
  
  const cookieStore = await cookies();
  cookieStore.set("session", session, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // No maxAge or expires means this becomes a "Session Cookie"
    // which automatically deletes itself when the browser is closed.
    path: "/",
  });
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
}

export async function getSession(req?: any) {
  // Use the request's cookies in middleware, otherwise fall back to Next.js cookies helper
  const cookieStore = req && typeof req.cookies?.get === "function"
    ? req.cookies
    : await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;
  try {
    return await decrypt(session);
  } catch (err) {
    return null;
  }
}
