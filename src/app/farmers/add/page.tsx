"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, Save } from "lucide-react";
import { AlertModal } from "@/components/ui/AlertModal";

export default function AddFarmerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  
  // Alert Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"success" | "error">("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get("name"),
      phone: formData.get("phone"),
      email: formData.get("email"),
    };

    try {
      const res = await fetch("/api/farmers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to add farmer");
      }

      const newFarmer = await res.json();
      
      setModalType("success");
      setModalTitle("Entry Successful");
      setModalMessage(`Farmer added successfully!\nGenerated ID: ${newFarmer.farmerNo}`);
      setModalOpen(true);
      
      (e.target as HTMLFormElement).reset();
    } catch (err: any) {
      setModalType("error");
      setModalTitle("Entry Unsuccessful");
      setModalMessage(err.message);
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto h-full flex flex-col pt-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-blue-100 p-3 rounded-full">
          <Users className="w-6 h-6 text-green-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">Add New Farmer</h1>
          <p className="text-slate-500">Register a new farmer into the system. A unique ID will be auto-generated.</p>
        </div>
      </div>

      <AlertModal
        isOpen={modalOpen}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setModalOpen(false)}
      />

      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="name" className="block text-sm font-medium text-slate-700">
              Full Name *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              required
              placeholder="e.g. Ramesh Kumar"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="phone" className="block text-sm font-medium text-slate-700">
              Phone Number *
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              required
              placeholder="e.g. +91 9876543210"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Email Address (Optional)
            </label>
            <input
              type="email"
              id="email"
              name="email"
              placeholder="e.g. ramesh@example.com"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-all disabled:opacity-70 disabled:cursor-not-allowed mt-4"
          >
            {loading ? (
              <span className="animate-pulse">Saving...</span>
            ) : (
              <>
                <Save className="w-5 h-5" />
                Register Farmer
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
