"use client";

import { useState } from "react";
import { Calculator, Search, Download, TrendingUp, Lock } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { getAcademicYearFromDate, getAcademicYearOptions } from "@/lib/academicYear";

export default function TotalFinalPage() {
  const [searchId, setSearchId] = useState("");
  const [academicYear, setAcademicYear] = useState(() => getAcademicYearFromDate());
  const yearOptions = getAcademicYearOptions();

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
      const res = await fetch(
        `/api/total/${searchId.toUpperCase()}?academicYear=${academicYear}`
      );
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
    const { shopInfo, farmer, processedBills, processedCash, processedCrops, summary, isSettled } = data;

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
    doc.text(`TOTAL FINAL STATEMENT (${academicYear})`, 105, 36, { align: "center" });

    doc.setDrawColor(21, 128, 61);
    doc.setLineWidth(0.5);
    doc.line(14, 40, 196, 40);

    // Farmer Details
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Farmer Information", 14, 48);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${farmer.name}`, 14, 54);
    doc.text(`Farmer ID: ${farmer.farmerNo}`, 14, 60);
    doc.text(`Phone: ${farmer.phone}`, 14, 66);
    doc.text(`Academic Year: ${academicYear}`, 130, 48);
    doc.text(`Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 130, 54);
    doc.text(`Status: ${isSettled ? "SETTLED / CLOSED" : "OPEN"}`, 130, 60);

    // Filter categories
    const pesticides = processedBills.filter((b: any) => b.category === "PESTICIDE");
    const fertilizers = processedBills.filter((b: any) => b.category === "FERTILIZER");
    const cashTaken = processedCash.filter((c: any) => c.type === "TAKEN");
    const cashGiven = processedCash.filter((c: any) => c.type === "GIVEN");
    const unsettledCrops = processedCrops.filter((c: any) => !c.isSettled);
    const settledCrops = processedCrops.filter((c: any) => c.isSettled);

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
    doc.text(`Rs. ${summary.shopPurchases.toFixed(2)}`, 186, startY + 12, { align: "right" });

    doc.text("Net Money Balance", 20, startY + 20);
    doc.text(`Rs. ${summary.netMoneyBalance.toFixed(2)}`, 186, startY + 20, { align: "right" });

    doc.text("Unsettled Crops", 20, startY + 28);
    doc.text(`Rs. ${summary.totalUnsettledCrops.toFixed(2)}`, 186, startY + 28, { align: "right" });

    doc.setDrawColor(150);
    doc.setLineWidth(0.5);
    doc.line(20, startY + 34, 186, startY + 34);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("FINAL AMOUNT", 20, startY + 43);
    doc.text(`Rs. ${Math.abs(summary.grandTotal).toFixed(2)}`, 186, startY + 43, { align: "right" });

    doc.line(20, startY + 48, 186, startY + 48);

    doc.setFontSize(11);
    const isPayableByFarmer = summary.grandTotal >= 0;
    doc.setTextColor(isPayableByFarmer ? 192 : 39, isPayableByFarmer ? 57 : 174, isPayableByFarmer ? 43 : 96);
    doc.text(
      isPayableByFarmer ? "PAYABLE BY FARMER" : "PAYABLE TO FARMER",
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
            View total calculations per Academic Year. Closed years are displayed as Read-Only.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Enter Farmer ID</label>
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="e.g. F-001"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none uppercase"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Academic Year</label>
            <select
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white font-bold text-slate-800"
            >
              {yearOptions.map((ay) => (
                <option key={ay} value={ay}>
                  {ay}
                </option>
              ))}
            </select>
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
          {/* Read Only Status Banner */}
          {data.isSettled && (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Lock className="w-6 h-6 text-amber-700 flex-shrink-0" />
                <div>
                  <p className="font-bold text-amber-900 text-sm">
                    ⚠️ Academic Year {data.academicYear} is SETTLED / CLOSED
                  </p>
                  <p className="text-amber-800 text-xs">
                    This is a read-only historical statement. Current balance is unaffected.
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
                ₹{data.summary.shopPurchases.toFixed(2)}
              </p>
            </div>
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 font-medium mb-2 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" /> Total Interest (₹2/mo)
              </h3>
              <p className="text-3xl font-bold text-orange-600">
                ₹{data.summary.totalInterest.toFixed(2)}
              </p>
            </div>
            <div className="bg-green-950 p-6 rounded-xl border border-slate-800 shadow-sm text-white">
              <h3 className="text-slate-400 font-medium mb-2 text-sm">Final Net Payable</h3>
              <p className="text-3xl font-bold text-white">
                ₹{Math.abs(data.summary.grandTotal).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 flex justify-between items-center">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-800">{data.farmer.name}</h2>
                <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-3 py-1 rounded-full">
                  AY {data.academicYear}
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
