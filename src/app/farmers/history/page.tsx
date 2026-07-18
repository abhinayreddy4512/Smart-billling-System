"use client";

import { useState } from "react";
import { History, Search, Download, FileText } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export default function FarmerHistoryPage() {
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [farmerData, setFarmerData] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId) return;

    setLoading(true);
    setError("");
    setFarmerData(null);

    try {
      const res = await fetch(`/api/farmers/${searchId.toUpperCase()}/history`);
      if (!res.ok) {
        throw new Error("Farmer not found or error fetching history");
      }
      const data = await res.json();
      setFarmerData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!farmerData) return;

    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text("Farmer Purchase History", 14, 22);

    // Farmer Info
    doc.setFontSize(12);
    doc.text(`Farmer ID: ${farmerData.id}`, 14, 32);
    doc.text(`Name: ${farmerData.name}`, 14, 38);
    doc.text(`Phone: ${farmerData.phone}`, 14, 44);

    // Table Data
    const tableColumn = ["Date", "Category", "Product", "Quantity", "Price", "Total"];
    const tableRows: any[] = [];

    farmerData.bills.forEach((bill: any) => {
      const billData = [
        format(new Date(bill.date), "dd/MM/yyyy HH:mm"),
        bill.category,
        bill.product,
        bill.quantity.toString(),
        `₹${bill.price.toFixed(2)}`,
        `₹${bill.total.toFixed(2)}`,
      ];
      tableRows.push(billData);
    });

    autoTable(doc, {
      startY: 50,
      head: [tableColumn],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
    });

    const pdfBlobUrl = doc.output("bloburl");
    window.open(pdfBlobUrl, "_blank");
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col pt-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-emerald-100 p-3 rounded-full">
          <History className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">Farmer History</h1>
          <p className="text-slate-500">View purchasing history and export statements.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label htmlFor="searchId" className="block text-sm font-medium text-slate-700">
              Enter Farmer ID
            </label>
            <input
              type="text"
              id="searchId"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="e.g. F-001"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 h-[42px] rounded-lg font-medium transition-all disabled:opacity-70"
          >
            {loading ? "Searching..." : <><Search className="w-4 h-4" /> Search</>}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
            {error}
          </div>
        )}
      </div>

      {farmerData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{farmerData.name}</h2>
              <p className="text-slate-500 text-sm mt-1 flex items-center gap-4">
                <span>ID: <strong className="text-slate-700">{farmerData.id}</strong></span>
                <span>Phone: <strong className="text-slate-700">{farmerData.phone}</strong></span>
              </p>
            </div>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-slate-800 hover:bg-green-950 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold border-b">Date</th>
                  <th className="px-6 py-4 font-semibold border-b">Category</th>
                  <th className="px-6 py-4 font-semibold border-b">Product</th>
                  <th className="px-6 py-4 font-semibold border-b text-right">Qty</th>
                  <th className="px-6 py-4 font-semibold border-b text-right">Price</th>
                  <th className="px-6 py-4 font-semibold border-b text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {farmerData.bills.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <FileText className="w-8 h-8 text-slate-300" />
                        <p>No purchase history found for this farmer.</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  farmerData.bills.map((bill: any) => (
                    <tr key={bill.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                        {format(new Date(bill.date), "dd/MM/yyyy HH:mm")}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          bill.category === "FERTILIZER" ? "bg-amber-100 text-amber-700" : "bg-teal-100 text-teal-700"
                        }`}>
                          {bill.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-800">{bill.product}</td>
                      <td className="px-6 py-4 text-right">{bill.quantity}</td>
                      <td className="px-6 py-4 text-right">₹{bill.price.toFixed(2)}</td>
                      <td className="px-6 py-4 text-right font-semibold text-green-950">
                        ₹{bill.total.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
