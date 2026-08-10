"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogIn, Mail, Lock } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  
  const [activeTab, setActiveTab] = useState<"owner" | "customer">("owner");
  
  // Owner State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Customer State
  const [phone, setPhone] = useState("");
  const [farmerNo, setFarmerNo] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (activeTab === "owner") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Login failed");
        }

        const data = await res.json();
        
        if (!data.user.shopName) {
          router.push("/onboarding");
        } else {
          window.location.href = "/";
        }
      } else {
        const res = await fetch("/api/auth/customer-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, farmerNo }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Login failed");
        }
        
        window.location.href = "/customer/dashboard";
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
        <div className="bg-green-950 p-8 text-center">
          <div className="bg-green-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <LogIn className="w-8 h-8 text-green-100" />
          </div>
          <h1 className="text-2xl font-bold text-white">Smart Billing System</h1>
          <p className="text-green-200 mt-2 text-sm">Sign in to manage your shop</p>
        </div>
        
        <div className="p-8">
          {/* Tabs */}
          <div className="flex rounded-lg bg-slate-100 p-1 mb-6">
            <button
              type="button"
              onClick={() => {
                setActiveTab("owner");
                setError("");
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === "owner" 
                  ? "bg-white text-green-700 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Shop Owner
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("customer");
                setError("");
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                activeTab === "customer" 
                  ? "bg-white text-green-700 shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Customer
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100 text-center">
                {error}
              </div>
            )}
            
            {activeTab === "owner" ? (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Email Address</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                      placeholder="admin@shop.com"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Password</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="block w-full pl-10 pr-3 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Registered Phone Number</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      onFocus={() => {
                        if (!phone) setPhone("+91");
                      }}
                      className="block w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
                      placeholder="e.g. +91 9876543210"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Farmer ID</label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={farmerNo}
                      onChange={(e) => setFarmerNo(e.target.value)}
                      className="block w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all uppercase"
                      placeholder="e.g. 1001"
                    />
                  </div>
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors disabled:opacity-70"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          {activeTab === "owner" && (
            <p className="mt-6 text-center text-sm text-slate-500">
              Don't have an account?{" "}
              <Link href="/register" className="font-medium text-green-600 hover:text-green-500">
                Create one now
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
