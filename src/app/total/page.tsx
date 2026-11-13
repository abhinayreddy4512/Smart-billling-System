"use client";

import { useState } from "react";
import { Calculator, Search, Download, TrendingUp, Lock, RefreshCw, Calendar } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export default function TotalFinalPage() {
  const [searchId, setSearchId] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState("active");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  const fetchTotal = async (farmerNo: string, cycleId: string) => {
    if (!farmerNo) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `/api/total/${farmerNo.toUpperCase()}?cycleId=${cycleId}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to calculate total for this farmer");
      }
      const result = await res.json();
      setData(result);
      if (result.cycle?.id) {
        setSelectedCycleId(result.cycle.id);
      }
    } catch (err: any) {
      setError(err.message);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchTotal(searchId, selectedCycleId);
  };

  const handleCycleChange = (newCycleId: string) => {
    setSelectedCycleId(newCycleId);
    if (data?.farmer?.farmerNo) {
      fetchTotal(data.farmer.farmerNo, newCycleId);
    }
  };

  const handleExportPDF = () => {
    if (!data) return;

    const doc = new jsPDF();
    const { shopInfo, farmer, processedBills, processedCash, processedCrops, summary, isSettled, cycle } = data;

    // Header - Shop Details
    if (shopInfo?.shopName) {
      doc.setFontSize(22);
      doc.setTextColor(21, 128, 61);
      doc.setFont("helvetica", "bold");
      doc.text(shopInfo.shopName.toUpperCase(), 105, 20, { align: "center" });
    }

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text("Pesticides, Seeds & Fertilizers", 105, 26, { align: "center" });

    doc.setFontSize(15);
    doc.setTextColor(44, 62, 80);
    doc.setFont("helvetica", "bold");
    doc.text(`TOTAL FINAL STATEMENT`, 105, 34, { align: "center" });
    doc.setFontSize(10);
    doc.setTextColor(80);
    doc.setFont("helvetica", "normal");
    doc.text(`Accounting Cycle: ${cycle?.label || "Active Cycle"}`, 105, 40, { align: "center" });

    doc.setDrawColor(21, 128, 61);
    doc.setLineWidth(0.5);
    doc.line(14, 43, 196, 43);

    // Farmer Details
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Farmer Information", 14, 50);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${farmer.name}`, 14, 56);
    doc.text(`Farmer ID: ${farmer.farmerNo}`, 14, 62);
    doc.text(`Phone: ${farmer.phone}`, 14, 68);
    doc.text(`Cycle: ${cycle?.shortLabel || "Active"}`, 130, 50);
    doc.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 130, 56);
    doc.text(`Status: ${isSettled ? "SETTLED / CLOSED" : "ACTIVE / OPEN"}`, 130, 62);

    // Filter categories
    const pesticides = (processedBills || []).filter((b: any) => b.category === "PESTICIDE");
    const fertilizers = (processedBills || []).filter((b: any) => b.category === "FERTILIZER");
    const cashTaken = (processedCash || []).filter((c: any) => c.type === "TAKEN");
    const cashGiven = (processedCash || []).filter((c: any) => c.type === "GIVEN");
    const unsettledCrops = (processedCrops || []).filter((c: any) => !c.isSettled);
    const settledCrops = (processedCrops || []).filter((c: any) => c.isSettled);

    let startY = 76;

    const renderTable = (title: string, items: any[], headColor: number[]) => {
      if (items.length === 0) return;
      if (startY > 230) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(11);
      doc.setTextColor(40);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, startY - 2);

      const rows = items.map((i: any) => [
        i.billNo || i.receiptNo || i.logNo || "-",
        format(new Date(i.date), "dd/MM/yyyy"),
        i.product || i.cropType || i.type,
        `Rs ${(i.total || i.amount).toFixed(2)}`,
        `Rs ${(i.interest || 0).toFixed(2)}`,
        `Rs ${(i.finalAmount || i.amount).toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY,
        head: [["ID", "Date", "Item/Type", "Principal", "Interest", "Total Amount"]],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: headColor as [number, number, number] },
        margin: { left: 14, right: 14 },
      });
      startY = (doc as any).lastAutoTable.finalY + 12;
    };

    renderTable("1. Pesticides", pesticides, [192, 57, 43]);
    renderTable("2. Fertilizers", fertilizers, [41, 128, 185]);
    renderTable("3. Money Taken (Loans/Borrowed)", cashTaken, [211, 84, 0]);
    renderTable("4. Money Given (Loan Repayments)", cashGiven, [39, 174, 96]);
    renderTable("5. Unsettled Crops (0% Interest)", unsettledCrops, [39, 174, 96]);

    if (settledCrops.length > 0) {
      if (startY > 230) {
        doc.addPage();
        startY = 20;
      }
      doc.setFontSize(11);
      doc.setTextColor(120);
      doc.setFont("helvetica", "bold");
      doc.text("6. Settled Crops (Reference Only)", 14, startY - 2);

      autoTable(doc, {
        startY,
        head: [["Log ID", "Date", "Crop Type", "Amount", "Status"]],
        body: settledCrops.map((c: any) => [
          c.logNo || "-",
          format(new Date(c.date), "dd/MM/yyyy"),
          c.cropType,
          `Rs ${c.amount.toFixed(2)}`,
          "Settled ✓",
        ]),
        theme: "grid",
        headStyles: { fillColor: [149, 165, 166] },
        margin: { left: 14, right: 14 },
      });
      startY = (doc as any).lastAutoTable.finalY + 12;
    }

    // Bottom calculation box
    if (startY > 210) {
      doc.addPage();
      startY = 20;
    }

    doc.setDrawColor(200);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, startY, 182, 65, "FD");

    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.setFont("helvetica", "bold");

    doc.text("Shop Purchases", 20, startY + 12);
    doc.text(`Rs. ${(summary.shopPurchases || summary.shopPurchasesTotal || 0).toFixed(2)}`, 186, startY + 12, { align: "right" });

    doc.text("Net Money Balance", 20, startY + 20);
    doc.text(`Rs. ${(summary.netMoneyBalance || 0).toFixed(2)}`, 186, startY + 20, { align: "right" });

    doc.text("Unsettled Crops", 20, startY + 28);
    doc.text(`Rs. ${(summary.totalUnsettledCrops || summary.unsettledCropsTotal || 0).toFixed(2)}`, 186, startY + 28, { align: "right" });

    doc.setDrawColor(150);
    doc.setLineWidth(0.5);
    doc.line(20, startY + 34, 186, startY + 34);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("FINAL AMOUNT", 20, startY + 43);
    const finalVal = summary.finalAmount !== undefined ? summary.finalAmount : summary.grandTotal;
    doc.text(`Rs. ${Math.abs(finalVal || 0).toFixed(2)}`, 186, startY + 43, { align: "right" });

    doc.line(20, startY + 48, 186, startY + 48);

    doc.setFontSize(11);
    const isPayableByFarmer = (finalVal || 0) >= 0;
    doc.setTextColor(isPayableByFarmer ? 192 : 39, isPayableByFarmer ? 57 : 174, isPayableByFarmer ? 43 : 96);
    doc.text(
      isPayableByFarmer ? "PAYABLE BY FARMER (Owes Shop)" : "PAYABLE TO FARMER (Shop Owes)",
      103,
      startY + 57,
      { align: "center" }
    );

    const pdfBlobUrl = doc.output("bloburl");
    window.open(pdfBlobUrl, "_blank");
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col pt-8 pb-12 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-orange-100 p-3 rounded-full">
          <Calculator className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">Total Final Statement</h1>
          <p className="text-slate-500">
            View total calculations per farmer accounting cycle. Closed cycles are displayed as Read-Only.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5 md:col-span-2">
            <label className="block text-sm font-medium text-slate-700">Enter Farmer ID</label>
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="e.g. 1001"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none uppercase"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 h-[42px] rounded-lg font-medium transition-all disabled:opacity-70"
          >
            {loading ? "Calculating..." : <><Search className="w-4 h-4" /> Calculate</>}
          </button>
        </form>

        {error && <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg text-sm">{error}</div>}
      </div>

      {data && (
        <div className="space-y-6 flex-1">
          {/* Cycle Switcher Header */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-orange-600" />
              <div>
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Accounting Cycle</span>
                <p className="text-base font-bold text-slate-800">{data.cycle?.label}</p>
              </div>
            </div>

            {data.allCycles && data.allCycles.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600">Switch Cycle:</span>
                <select
                  value={selectedCycleId}
                  onChange={(e) => handleCycleChange(e.target.value)}
                  className="px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-orange-500"
                >
                  {data.allCycles.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.label} {c.isClosed ? "[CLOSED]" : "[ACTIVE]"}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Read Only Status Banner */}
          {data.isSettled && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-amber-700 flex-shrink-0" />
                <div>
                  <p className="font-bold text-amber-900 text-sm">
                    ⚠️ {data.cycle?.shortLabel} is SETTLED / CLOSED
                  </p>
                  <p className="text-amber-800 text-xs">
                    This is a read-only historical statement. Current cycle balance is unaffected.
                  </p>
                </div>
              </div>
              <span className="text-xs bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full uppercase">
                SETTLED
              </span>
            </div>
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 font-medium mb-2 text-sm">Purchases Subtotal</h3>
              <p className="text-3xl font-bold text-slate-800">
                ₹{(data.summary.shopPurchases || data.summary.shopPurchasesTotal || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 font-medium mb-2 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" /> Total Interest (₹2/mo)
              </h3>
              <p className="text-3xl font-bold text-orange-600">
                ₹{(data.summary.totalInterest || 0).toFixed(2)}
              </p>
            </div>
            <div className="bg-green-950 p-6 rounded-xl border border-slate-800 shadow-sm text-white">
              <h3 className="text-slate-400 font-medium mb-2 text-sm">Final Net Balance</h3>
              <p className="text-3xl font-bold text-white">
                ₹{Math.abs(data.summary.finalAmount !== undefined ? data.summary.finalAmount : data.summary.grandTotal).toFixed(2)}
              </p>
              <p className="text-xs text-green-300 mt-1">
                {(data.summary.finalAmount !== undefined ? data.summary.finalAmount : data.summary.grandTotal) >= 0
                  ? "Farmer owes shop"
                  : "Shop owes farmer"}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-800">{data.farmer.name}</h2>
                <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-3 py-1 rounded-full">
                  {data.cycle?.shortLabel || "Active"}
                </span>
              </div>
              <p className="text-slate-500 text-sm mt-1">
                ID: {data.farmer.farmerNo} | Phone: {data.farmer.phone}
              </p>
            </div>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-slate-800 hover:bg-green-950 text-white px-6 py-3 rounded-lg font-medium transition-all shadow-sm"
            >
              <Download className="w-5 h-5" /> Export Final PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
