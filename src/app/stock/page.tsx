"use client";

import { useState, useEffect } from "react";
import { PackageSearch, Plus, Package } from "lucide-react";
import { AlertModal } from "@/components/ui/AlertModal";

export default function StockUpdatesPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  
  // Alert Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"success" | "error">("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/stock");
      if (!res.ok) throw new Error("Failed to fetch stock");
      const data = await res.json();
      setProducts(data);
    } catch (err: any) {
      // Background fail
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleAddStock = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAdding(true);

    const formData = new FormData(e.currentTarget);
    const data = {
      category: formData.get("category"),
      name: formData.get("name"),
      size: formData.get("size"),
      quantity: formData.get("quantity"),
      price: formData.get("price"),
    };

    try {
      const res = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to add stock");
      }

      setModalType("success");
      setModalTitle("Entry Successful");
      setModalMessage("Product added to inventory successfully.");
      setModalOpen(true);
      
      (e.target as HTMLFormElement).reset();
      fetchProducts(); // Refresh list
    } catch (err: any) {
      setModalType("error");
      setModalTitle("Entry Unsuccessful");
      setModalMessage(err.message);
      setModalOpen(true);
    } finally {
      setAdding(false);
    }
  };


  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col pt-8 pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-amber-100 p-3 rounded-full">
          <PackageSearch className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">Stock Updates</h1>
          <p className="text-slate-500">Manage your fertilizers and pesticides inventory.</p>
        </div>
      </div>

      <AlertModal
        isOpen={modalOpen}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setModalOpen(false)}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Add New Stock Form */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-1">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-slate-500" /> Add New Item
          </h2>

          <form onSubmit={handleAddStock} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Category *</label>
              <select name="category" required className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none">
                <option value="FERTILIZER">Fertilizer</option>
                <option value="PESTICIDE">Pesticide</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Product Name *</label>
              <input type="text" name="name" required placeholder="e.g. Urea" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Size (Optional)</label>
              <input type="text" name="size" placeholder="e.g. 50kg, 1L" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">No. of Items *</label>
              <input type="number" name="quantity" required min="0" placeholder="0" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700">Price (₹) *</label>
              <input type="number" name="price" step="0.01" required min="0" placeholder="0.00" className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none" />
            </div>

            <button type="submit" disabled={adding} className="w-full bg-green-950 hover:bg-slate-800 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-70 mt-2">
              {adding ? "Adding..." : "Add to Inventory"}
            </button>
          </form>
        </div>

        {/* Stock Lists */}
        <div className="lg:col-span-2 space-y-6">
          {loading ? (
            <div className="p-8 text-center text-slate-500">Loading inventory...</div>
          ) : (
            <>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mt-2">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <PackageSearch className="w-5 h-5 text-slate-600" /> Stock Details (A-Z)
                  </h3>
                  <span className="bg-slate-200 text-slate-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {products.length} total items
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500">
                        <th className="px-4 py-3 font-medium border-b">Product Name</th>
                        <th className="px-4 py-3 font-medium border-b">Category</th>
                        <th className="px-4 py-3 font-medium border-b">Size</th>
                        <th className="px-4 py-3 font-medium border-b text-right">Items Remaining</th>
                        <th className="px-4 py-3 font-medium border-b text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {products.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No products in stock</td></tr>
                      ) : (
                        [...products].sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                          <tr key={`all-${p.id}`} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                p.category === "FERTILIZER" ? "bg-amber-100 text-amber-700" : "bg-teal-100 text-teal-700"
                              }`}>
                                {p.category === "FERTILIZER" ? "Fertilizer" : "Pesticide"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-500">{p.size || "-"}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${p.quantity < 10 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                                {p.quantity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">₹{p.price.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
