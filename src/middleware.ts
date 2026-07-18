import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const publicRoutes = ["/login", "/register", "/api/auth/login", "/api/auth/register"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (publicRoutes.includes(path) || path.startsWith("/_next") || path.startsWith("/favicon.ico")) {
    return NextResponse.next();
  }

  const session = await getSession(request);

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect to onboarding if shop details are missing
  const isSetupRoute = path === "/onboarding" || path === "/api/auth/onboarding";
  if (!session.user.shopName && !isSetupRoute) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }
  
  if (session.user.shopName && isSetupRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
