"use client";

import { useState } from "react";
import { Calculator, Search, Download, TrendingUp } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export default function TotalFinalPage() {
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId) return;

    setLoading(true);
    setError("");
    setData(null);

    try {
      const res = await fetch(`/api/total/${searchId.toUpperCase()}`);
      if (!res.ok) {
        throw new Error("Failed to calculate total for this farmer");
      }
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportPDF = () => {
    if (!data) return;

    const doc = new jsPDF();
    const { shopInfo, farmer, processedBills, processedCash, processedCrops } = data;

    // Header - Shop Details
    if (shopInfo?.shopName) {
      doc.setFontSize(24);
      doc.setTextColor(21, 128, 61);
      doc.setFont("helvetica", "bold");
      doc.text(shopInfo.shopName.toUpperCase(), 105, 20, { align: "center" });
    }

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text("Pesticides, Seeds & Fertilizers", 105, 26, { align: "center" });

    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.setFont("helvetica", "bold");
    doc.text("Total Final Statement", 105, 36, { align: "center" });

    doc.setDrawColor(21, 128, 61);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);

    // Farmer Details
    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Farmer Information", 14, 50);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${farmer.name}`, 14, 57);
    doc.text(`Farmer ID: ${farmer.farmerNo}`, 14, 63);
    doc.text(`Phone: ${farmer.phone}`, 14, 69);
    doc.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 120, 57);

    // Filter categories
    const pesticides = processedBills.filter((b: any) => b.category === "PESTICIDE");
    const fertilizers = processedBills.filter((b: any) => b.category === "FERTILIZER");
    const cashTaken = processedCash.filter((c: any) => c.type === "TAKEN");
    const cashGiven = processedCash.filter((c: any) => c.type === "GIVEN");
    const unsettledCrops = processedCrops.filter((c: any) => !c.isSettled);
    const settledCrops = processedCrops.filter((c: any) => c.isSettled);

    const sumFinal = (arr: any[]) => arr.reduce((acc, item) => acc + item.finalAmount, 0);

    const totalPesticides = sumFinal(pesticides);
    const totalFertilizers = sumFinal(fertilizers);
    const totalTaken = sumFinal(cashTaken);
    const totalGiven = sumFinal(cashGiven);
    const totalUnsettledCrops = sumFinal(unsettledCrops);

    const shopPurchases = totalPesticides + totalFertilizers;
    const moneyDiff = totalTaken - totalGiven;
    const grandTotal = shopPurchases + moneyDiff - totalUnsettledCrops;

    let startY = 80;

    // Helper for tables
    const renderTable = (title: string, items: any[], headColor: number[]) => {
      if (items.length === 0) return;
      
      if (startY > 230) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, startY - 2);
      
      const rows = items.map((i: any) => [
        i.billNo || i.receiptNo || i.logNo || "-",
        format(new Date(i.date), "dd/MM/yyyy"),
        i.product || i.cropType || i.type,
        `Rs ${(i.total || i.amount).toFixed(2)}`,
        `Rs ${(i.interest || 0).toFixed(2)}`,
        `Rs ${(i.finalAmount || i.amount).toFixed(2)}`
      ]);

      autoTable(doc, {
        startY,
        head: [["ID", "Date", "Item/Type", "Principal", "Interest", "Total Amount"]],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: headColor as [number, number, number] },
        margin: { top: 10 }
      });
      startY = (doc as any).lastAutoTable.finalY + 15;
    };

    renderTable("Pesticides (Purchases)", pesticides, [192, 57, 43]);
    renderTable("Fertilizers (Purchases)", fertilizers, [41, 128, 185]);
    renderTable("Money Taken (Loans/Borrowed)", cashTaken, [211, 84, 0]);
    renderTable("Money Given (Repayments)", cashGiven, [39, 174, 96]);
    renderTable("Unsettled Crops (Cotton & Mirchi - No Interest)", unsettledCrops, [39, 174, 96]);

    // Render Settled Crops Details if any
    if (settledCrops.length > 0) {
      if (startY > 230) {
        doc.addPage();
        startY = 20;
      }

      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.setFont("helvetica", "bold");
      doc.text("Settled Crops (Already Paid)", 14, startY - 2);
      
      const rows = settledCrops.map((c: any) => [
        c.logNo || "-",
        format(new Date(c.date), "dd/MM/yyyy"),
        c.cropType,
        `Rs ${c.amount.toFixed(2)}`,
        "Settled",
        `Rs ${c.amount.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY,
        head: [["Log ID", "Date", "Crop Type", "Amount", "Status", "Total Settled"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [149, 165, 166] },
        margin: { top: 10 }
      });
      startY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Bottom calculation box
    if (startY > 210) {
      doc.addPage();
      startY = 20;
    }

    doc.setDrawColor(200);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, startY, 182, 65, "FD");

    doc.setFontSize(11);
    doc.setTextColor(40);
    doc.setFont("helvetica", "bold");

    doc.text("Shop Purchases", 20, startY + 12);
    doc.text(`Rs. ${shopPurchases.toFixed(2)}`, 186, startY + 12, { align: "right" });

    doc.text("Money Transaction Difference", 20, startY + 20);
    const moneyDiffStr = `${moneyDiff < 0 ? "- " : ""}Rs. ${Math.abs(moneyDiff).toFixed(2)}`;
    doc.text(moneyDiffStr, 186, startY + 20, { align: "right" });

    doc.text("Unsettled Crops", 20, startY + 28);
    doc.text(`Rs. ${totalUnsettledCrops.toFixed(2)}`, 186, startY + 28, { align: "right" });

    doc.setDrawColor(150);
    doc.setLineWidth(0.5);
    doc.line(20, startY + 34, 186, startY + 34);

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("FINAL AMOUNT", 20, startY + 43);
    doc.text(`Rs. ${Math.abs(grandTotal).toFixed(2)}`, 186, startY + 43, { align: "right" });

    doc.line(20, startY + 48, 186, startY + 48);

    doc.setFontSize(12);
    const isPayableByFarmer = grandTotal >= 0;
    const resultLabel = isPayableByFarmer
      ? "PAYABLE BY FARMER"
      : "PAYABLE TO FARMER";

    if (isPayableByFarmer) {
      doc.setTextColor(192, 57, 43);
    } else {
      doc.setTextColor(39, 174, 96);
    }
    doc.text(resultLabel, 103, startY + 57, { align: "center" });

    const pdfBlobUrl = doc.output("bloburl");
    window.open(pdfBlobUrl, "_blank");
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col pt-8 pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-orange-100 p-3 rounded-full">
          <Calculator className="w-6 h-6 text-orange-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">Total Final Calculation</h1>
          <p className="text-slate-500">Calculate interests at 2% per month and generate the final PDF statement.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="block text-sm font-medium text-slate-700">Enter Farmer ID</label>
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="e.g. F-001"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 h-[42px] rounded-lg font-medium transition-all disabled:opacity-70"
          >
            {loading ? "Calculating..." : <><Search className="w-4 h-4" /> Calculate</>}
          </button>
        </form>
        {error && <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}
      </div>

      {data && (
        <div className="space-y-6 flex-1">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 font-medium mb-2">Total Principal</h3>
              <p className="text-3xl font-bold text-slate-800">₹{data.summary.totalPrincipal.toFixed(2)}</p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 font-medium mb-2 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" /> Total Interest
              </h3>
              <p className="text-3xl font-bold text-orange-600">₹{data.summary.totalInterest.toFixed(2)}</p>
            </div>
            <div className="bg-green-950 p-6 rounded-xl border border-slate-800 shadow-sm text-white">
              <h3 className="text-slate-400 font-medium mb-2">Final Outstanding Amount</h3>
              <p className="text-3xl font-bold text-white">₹{data.summary.finalAmount.toFixed(2)}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex justify-between items-center">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{data.farmer.name}</h2>
              <p className="text-slate-500 text-sm">ID: {data.farmer.farmerNo} | Phone: {data.farmer.phone}</p>
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
