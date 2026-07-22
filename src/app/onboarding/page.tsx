"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/auth";
import { NextResponse } from "next/server";

export default function OnboardingPage() {
  const router = useRouter();
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [phone, setPhone] = useState("");
  const [gstNo, setGstNo] = useState("");
  const [village, setVillage] = useState("");
  const [mandal, setMandal] = useState("");
  const [district, setDistrict] = useState("");
  const [state, setState] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shopName, ownerName, phone, gstNo, village, mandal, district, state }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Onboarding failed");
      }
      // Refresh session (re‑issue cookie with shopName)
      router.push("/");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
        <h1 className="text-2xl font-bold text-green-950 mb-4">Shop Onboarding</h1>
        {error && <p className="text-red-600 mb-2">{error}</p>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <input placeholder="Shop Name" value={shopName} onChange={e=>setShopName(e.target.value)} className="w-full border p-2 rounded" required />
          <input placeholder="Owner Name" value={ownerName} onChange={e=>setOwnerName(e.target.value)} className="w-full border p-2 rounded" required />
          <input placeholder="Phone" value={phone} onChange={e=>setPhone(e.target.value)} className="w-full border p-2 rounded" required />
          <input placeholder="GST No" value={gstNo} onChange={e=>setGstNo(e.target.value)} className="w-full border p-2 rounded" />
          <input placeholder="Village" value={village} onChange={e=>setVillage(e.target.value)} className="w-full border p-2 rounded" />
          <input placeholder="Mandal" value={mandal} onChange={e=>setMandal(e.target.value)} className="w-full border p-2 rounded" />
          <input placeholder="District" value={district} onChange={e=>setDistrict(e.target.value)} className="w-full border p-2 rounded" />
          <input placeholder="State" value={state} onChange={e=>setState(e.target.value)} className="w-full border p-2 rounded" />
          <button type="submit" disabled={loading} className="w-full bg-green-600 text-white py-2 rounded">{loading ? "Saving…" : "Save"}</button>
        </form>
      </div>
    </div>
  );
}
