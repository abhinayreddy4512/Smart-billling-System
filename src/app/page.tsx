import Link from "next/link";
import { Users, PackageSearch, Receipt, Calculator } from "lucide-react";

export default function Home() {
  return (
    <div className="flex flex-col gap-8 h-full">
      <div>
        <h1 className="text-4xl font-bold tracking-tight text-green-950">Dashboard</h1>
        <p className="text-slate-500 mt-2 text-lg">
          Welcome to the Smart Billing System. Select a module to get started.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-4">
        {/* Quick Access Cards */}
        <Link href="/farmers/add" className="group">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-green-500 h-full flex flex-col items-center justify-center gap-4 text-center">
            <div className="bg-blue-100 p-4 rounded-full group-hover:bg-green-700 transition-colors">
              <Users className="w-8 h-8 text-green-700 group-hover:text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-green-950">Manage Farmers</h3>
              <p className="text-sm text-slate-500">Add or view farmer history</p>
            </div>
          </div>
        </Link>

        <Link href="/stock" className="group">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:green-500 h-full flex flex-col items-center justify-center gap-4 text-center">
            <div className="bg-green-100 p-4 rounded-full group-hover:bg-green-600 transition-colors">
              <PackageSearch className="w-8 h-8 text-green-600 group-hover:text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-green-950">Stock Updates</h3>
              <p className="text-sm text-slate-500">Fertilizers & Pesticides</p>
            </div>
          </div>
        </Link>

        <Link href="/billing" className="group">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-purple-500 h-full flex flex-col items-center justify-center gap-4 text-center">
            <div className="bg-purple-100 p-4 rounded-full group-hover:bg-purple-600 transition-colors">
              <Receipt className="w-8 h-8 text-purple-600 group-hover:text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-green-950">Billing</h3>
              <p className="text-sm text-slate-500">Generate bills & photos</p>
            </div>
          </div>
        </Link>

        <Link href="/total" className="group">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md hover:border-orange-500 h-full flex flex-col items-center justify-center gap-4 text-center">
            <div className="bg-orange-100 p-4 rounded-full group-hover:bg-orange-600 transition-colors">
              <Calculator className="w-8 h-8 text-orange-600 group-hover:text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-green-950">Total Final</h3>
              <p className="text-sm text-slate-500">Calculate totals & interests</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}
