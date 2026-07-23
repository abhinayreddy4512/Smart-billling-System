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
  LogOut
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { name: "Add Farmers", href: "/farmers/add", icon: Users },
  { name: "Farmer History", href: "/farmers/history", icon: History },
  { name: "Stock Updates", href: "/stock", icon: PackageSearch },
  { name: "Billing", href: "/billing", icon: Receipt },
  { name: "Cash Section", href: "/cash", icon: Banknote },
  { name: "Cotton & Mirchi", href: "/crops", icon: Sprout },
  { name: "Total Final", href: "/total", icon: Calculator },
];

export function Sidebar({ shopName = "SMART BILLING" }: { shopName?: string }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh(); // Force a full reload to clear Server Component state
    } catch (err) {
      console.error("Logout failed", err);
    }
  };

  return (
    <div className="flex flex-col w-64 bg-green-900 text-green-50 min-h-screen border-r border-green-800">
      <Link href="/" className="flex items-center justify-center h-16 border-b border-green-800 hover:bg-green-800 transition-colors">
        <h1 className="text-xl font-bold text-white tracking-wider truncate px-4">{shopName.toUpperCase()}</h1>
      </Link>
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
                  <Icon className="w-5 h-5" />
                  {item.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="p-4 border-t border-green-800 space-y-4">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-950 hover:bg-red-600 text-green-100 hover:text-white rounded-md transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span className="font-medium">Logout</span>
        </button>
        <div className="text-xs text-green-200/70 text-center">
          &copy; {new Date().getFullYear()} {shopName}
        </div>
      </div>
    </div>
  );
}
