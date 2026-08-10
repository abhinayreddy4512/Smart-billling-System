"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";

export function AppWrapper({ children, shopName }: { children: React.ReactNode, shopName?: string | null }) {
  const pathname = usePathname();
  
  const isAuthPage = pathname === "/login" || pathname === "/register" || pathname === "/onboarding";
  const isCustomerRoute = pathname.startsWith("/customer");

  if (isAuthPage || isCustomerRoute) {
    return (
      <main className="flex-1 overflow-y-auto min-h-screen">
        {children}
      </main>
    );
  }

  return (
    <>
      <Sidebar shopName={shopName} />
      <main className="flex-1 overflow-y-auto p-4 md:p-8 h-[calc(100vh-68px)] md:h-screen w-full relative">
        {children}
      </main>
    </>
  );
}
