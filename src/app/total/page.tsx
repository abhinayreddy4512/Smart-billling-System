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
    const { farmer, summary, processedBills, processedCash, processedCrops } = data;

    // Header
    doc.setFontSize(22);
    doc.setTextColor(41, 128, 185);
    doc.text("Final Settlement Statement", 14, 22);

    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Generated on: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 30);

    // Farmer Details
    doc.setFontSize(12);
    doc.setTextColor(40);
    doc.text(`Farmer ID: ${farmer.id}`, 14, 40);
    doc.text(`Name: ${farmer.name}`, 14, 46);
    doc.text(`Phone: ${farmer.phone}`, 14, 52);

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
    const grandTotal = totalPesticides + totalFertilizers + totalTaken - totalGiven - totalUnsettledCrops;

    let startY = 65;

    // Helper for tables
    const renderTable = (title: string, items: any[], headColor: number[]) => {
      if (items.length === 0) return;
      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.text(title, 14, startY - 2);
      
      const rows = items.map((i: any) => [
        format(new Date(i.date), "dd/MM/yyyy"),
        i.product || i.cropType || i.type,
        `Rs ${(i.total || i.amount).toFixed(2)}`,
        `Rs ${i.interest.toFixed(2)}`,
        `Rs ${i.finalAmount.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY,
        head: [["Date", "Item/Type", "Principal", "Interest", "Total Amount"]],
        body: rows,
        theme: "striped",
        headStyles: { fillColor: headColor as [number, number, number] },
        margin: { top: 10 }
      });
      startY = (doc as any).lastAutoTable.finalY + 15;
    };

    renderTable("Pesticides (Purchases)", pesticides, [192, 57, 43]); // Red
    renderTable("Fertilizers (Purchases)", fertilizers, [41, 128, 185]); // Blue
    renderTable("Cash Taken (Loans)", cashTaken, [211, 84, 0]); // Orange
    renderTable("Cash Given (Repayments)", cashGiven, [39, 174, 96]); // Green
    
    // As per user request: "if not settled add that amount in pdf with interest to money given section"
    renderTable("Unsettled Crops (Treated as Money Given)", unsettledCrops, [39, 174, 96]); // Green
    
    // "of all logs if settled enter how much settled"
    // Since settled crops don't accrue interest against the final debt (already paid), we just show them
    if (settledCrops.length > 0) {
      doc.setFontSize(12);
      doc.setTextColor(40);
      doc.text("Settled Crops (Already Paid)", 14, startY - 2);
      
      const rows = settledCrops.map((c: any) => [
        format(new Date(c.date), "dd/MM/yyyy"),
        c.cropType,
        `Rs ${c.amount.toFixed(2)}`,
        `Settled`,
        `-`,
        `Rs ${c.amount.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY,
        head: [["Date", "Crop", "Principal", "Status", "Interest", "Total Settled"]],
        body: rows,
        theme: "grid",
        headStyles: { fillColor: [149, 165, 166] }, // Gray
        margin: { top: 10 }
      });
      startY = (doc as any).lastAutoTable.finalY + 15;
    }

    // Grand Total Box at the bottom
    // Check if we need a new page for the summary
    if (startY > 210) {
      doc.addPage();
      startY = 20;
    }

    doc.setDrawColor(200);
    doc.setFillColor(245, 247, 250);
    doc.rect(14, startY, 182, 70, "FD"); // Increased height for more lines
    
    doc.setFontSize(14);
    doc.setTextColor(40);
    doc.text("Final Calculation Steps", 18, startY + 8);
    
    doc.setFontSize(11);
    
    // Step 1: Purchases
    doc.text(`Total Pesticides: Rs ${totalPesticides.toFixed(2)}`, 18, startY + 18);
    doc.text(`(+) Total Fertilizers: Rs ${totalFertilizers.toFixed(2)}`, 18, startY + 24);
    const subtotalPurchases = totalPesticides + totalFertilizers;
    doc.setFont("helvetica", "bold");
    doc.text(`(=) Subtotal (Purchases): Rs ${subtotalPurchases.toFixed(2)}`, 18, startY + 30);
    doc.setFont("helvetica", "normal");

    // Step 2: Cash Taken
    doc.text(`(+) Total Cash Taken: Rs ${totalTaken.toFixed(2)}`, 18, startY + 38);
    const totalDebt = subtotalPurchases + totalTaken;
    doc.setFont("helvetica", "bold");
    doc.text(`(=) Total Debt Accumulated: Rs ${totalDebt.toFixed(2)}`, 18, startY + 44);
    doc.setFont("helvetica", "normal");

    // Step 3: Repayments
    doc.setTextColor(39, 174, 96); // Green for deductions
    doc.text(`(-) Minus (Money Given + Unsettled Crops): Rs ${(totalGiven + totalUnsettledCrops).toFixed(2)}`, 18, startY + 52);
    
    // Final Line
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(192, 57, 43); // Red for final balance
    doc.text(`Final Outstanding Balance: Rs ${grandTotal.toFixed(2)}`, 85, startY + 63);

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
              <p className="text-slate-500 text-sm">ID: {data.farmer.id} | Phone: {data.farmer.phone}</p>
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
