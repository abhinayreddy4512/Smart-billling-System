"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  Users, 
  History, 
  PackageSearch, 
  Receipt, 
  Banknote, 
  Sprout, 
  Calculator,
  LogOut,
  Menu,
  X
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const navItems = [
  { name: "Add Farmers", href: "/farmers/add", icon: Users },
  { name: "Farmer History", href: "/farmers/history", icon: History },
  { name: "Stock Updates", href: "/stock", icon: PackageSearch },
  { name: "Billing", href: "/billing", icon: Receipt },
  { name: "Cash Section", href: "/cash", icon: Banknote },
  { name: "Cotton & Mirchi", href: "/crops", icon: Sprout },
  { name: "Total Final", href: "/total", icon: Calculator },
];

export function Sidebar({ shopName }: { shopName?: string | null }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    
    window.location.href = "/login";
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between bg-green-900 text-white p-4 sticky top-0 z-50">
        <h1 className="text-lg font-bold tracking-wider">{shopName ? shopName.toUpperCase() : "SMART BILLING"}</h1>
        <button onClick={() => setIsOpen(!isOpen)} className="p-2">
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* Sidebar Content */}
      <div className={cn(
        "flex flex-col w-full md:w-64 bg-green-900 text-green-50 min-h-[calc(100vh-60px)] md:min-h-screen border-r border-green-800 transition-all absolute md:relative z-40",
        isOpen ? "left-0 top-[60px]" : "-left-full md:left-0 top-[60px] md:top-0 hidden md:flex"
      )}>
        <div className="hidden md:flex items-center justify-center min-h-16 px-4 py-3 border-b border-green-800 text-center break-words">
          <h1 className="text-xl font-bold text-white tracking-wider">{shopName ? shopName.toUpperCase() : "SMART BILLING"}</h1>
        </div>
      <nav className="flex-1 overflow-y-auto py-4">
        <ul className="space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            
            return (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md transition-colors",
                    isActive 
                      ? "bg-white text-green-900 font-bold shadow-sm" 
                      : "hover:bg-green-800 hover:text-white"
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-green-800 flex flex-col gap-4 mt-auto">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 bg-green-800 hover:bg-green-700 text-green-50 px-4 py-2 rounded-lg font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Log Out
        </button>
        <div className="text-xs text-green-200/70 text-center">
          &copy; {new Date().getFullYear()} Smart Billing System
        </div>
      </div>
      </div>
    </>
  );
}
