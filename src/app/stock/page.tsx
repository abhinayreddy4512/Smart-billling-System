"use client";

import { useState, useEffect } from "react";
import { PackageSearch, Plus, Package } from "lucide-react";

export default function StockUpdatesPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchProducts = async () => {
    try {
      const res = await fetch("/api/stock");
      if (!res.ok) throw new Error("Failed to fetch stock");
      const data = await res.json();
      setProducts(data);
    } catch (err: any) {
      setError(err.message);
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
    setError("");
    setSuccess("");

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

      setSuccess("Product added successfully!");
      (e.target as HTMLFormElement).reset();
      fetchProducts(); // Refresh list
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const fertilizers = products.filter((p) => p.category === "FERTILIZER");
  const pesticides = products.filter((p) => p.category === "PESTICIDE");

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Add New Stock Form */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-1">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-slate-500" /> Add New Item
          </h2>
          
          {error && <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
          {success && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{success}</div>}

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
              {/* Fertilizers */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-amber-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-amber-900 flex items-center gap-2">
                    <Package className="w-5 h-5 text-amber-600" /> Fertilizers
                  </h3>
                  <span className="bg-amber-100 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {fertilizers.length} items
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500">
                        <th className="px-4 py-3 font-medium border-b">Product Name</th>
                        <th className="px-4 py-3 font-medium border-b">Size</th>
                        <th className="px-4 py-3 font-medium border-b text-right">Items</th>
                        <th className="px-4 py-3 font-medium border-b text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {fertilizers.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No fertilizers in stock</td></tr>
                      ) : (
                        fertilizers.map(f => (
                          <tr key={f.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800">{f.name}</td>
                            <td className="px-4 py-3 text-slate-500">{f.size || "-"}</td>
                            <td className="px-4 py-3 text-right">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${f.quantity < 10 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}`}>
                                {f.quantity}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-slate-600">₹{f.price.toFixed(2)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Pesticides */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-teal-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-teal-900 flex items-center gap-2">
                    <Package className="w-5 h-5 text-teal-600" /> Pesticides
                  </h3>
                  <span className="bg-teal-100 text-teal-800 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                    {pesticides.length} items
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500">
                        <th className="px-4 py-3 font-medium border-b">Product Name</th>
                        <th className="px-4 py-3 font-medium border-b">Size</th>
                        <th className="px-4 py-3 font-medium border-b text-right">Items</th>
                        <th className="px-4 py-3 font-medium border-b text-right">Price</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pesticides.length === 0 ? (
                        <tr><td colSpan={4} className="px-4 py-6 text-center text-slate-400">No pesticides in stock</td></tr>
                      ) : (
                        pesticides.map(p => (
                          <tr key={p.id} className="hover:bg-slate-50">
                            <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
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
