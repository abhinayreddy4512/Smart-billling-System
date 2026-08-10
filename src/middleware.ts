import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

const publicRoutes = ["/login", "/register", "/api/auth/login", "/api/auth/register", "/api/auth/customer-login"];

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;

  if (publicRoutes.includes(path) || path.startsWith("/_next") || path.startsWith("/favicon.ico")) {
    return NextResponse.next();
  }

  const session = await getSession(request);

  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Route protection based on role
  if (session.user.role === "customer") {
    // Customers can only access /customer/* and api routes (which are protected separately or here)
    if (!path.startsWith("/customer") && !path.startsWith("/api")) {
      return NextResponse.redirect(new URL("/customer/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Owners should not access customer routes
  if (path.startsWith("/customer")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Redirect to onboarding if shop details are missing (owners only)
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
