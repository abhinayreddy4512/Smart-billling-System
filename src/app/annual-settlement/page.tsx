"use client";

import { useState } from "react";
import {
  Calculator,
  Search,
  Download,
  FileText,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { AlertModal } from "@/components/ui/AlertModal";

export default function AnnualSettlementPage() {
  const [searchId, setSearchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);
  const [settled, setSettled] = useState(false);

  // Alert Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"success" | "error">("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchId) return;
    setLoading(true);
    setError("");
    setData(null);
    setSettled(false);

    try {
      const res = await fetch(
        `/api/annual-settlement/${searchId.toUpperCase()}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to calculate settlement");
      }
      const result = await res.json();
      setData(result);
      if (result.isAlreadySettled) {
        setSettled(true);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!data) return null;
    const { shopInfo, farmer, summary, periodStart, periodEnd, status, processedBills, processedCash, processedCrops } = data;

    const doc = new jsPDF();

    // Header
    const shopName = shopInfo?.shopName || "SMART BILLING";
    doc.setFontSize(24);
    doc.setTextColor(21, 128, 61);
    doc.setFont("helvetica", "bold");
    doc.text(shopName.toUpperCase(), 105, 20, { align: "center" });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text("Pesticides, Seeds & Fertilizers", 105, 26, { align: "center" });

    doc.setFontSize(16);
    doc.setTextColor(44, 62, 80);
    doc.setFont("helvetica", "bold");
    doc.text("Annual Final Settlement Statement", 105, 36, { align: "center" });

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

    // Settlement Period
    doc.setFont("helvetica", "bold");
    doc.text("Settlement Period", 120, 50);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Start Date: ${format(new Date(periodStart), "dd/MM/yyyy")}`,
      120,
      57
    );
    doc.text(
      `Settlement Date: ${format(new Date(periodEnd), "dd/MM/yyyy")}`,
      120,
      63
    );
    doc.text(
      `Status: ${status.replace("_", " ")}`,
      120,
      69
    );

    let startY = 80;

    // Filter categories for itemized tables
    const pesticides = processedBills.filter((b: any) => b.category === "PESTICIDE");
    const fertilizers = processedBills.filter((b: any) => b.category === "FERTILIZER");
    const cashTaken = processedCash.filter((c: any) => c.type === "TAKEN");
    const cashGiven = processedCash.filter((c: any) => c.type === "GIVEN");
    const unsettledCrops = processedCrops.filter((c: any) => !c.isSettled);
    const settledCrops = processedCrops.filter((c: any) => c.isSettled);

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

    // ---- Exact Layout Calculation Box as requested ----
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

    // Line 1: Shop Purchases
    doc.text("Shop Purchases", 20, startY + 12);
    doc.text(`Rs. ${summary.shopPurchasesTotal.toFixed(2)}`, 186, startY + 12, { align: "right" });

    // Line 2: Money Transaction Difference
    doc.text("Money Transaction Difference", 20, startY + 20);
    const moneyDiffStr = `${summary.moneyTransactionDiff < 0 ? "- " : ""}Rs. ${Math.abs(summary.moneyTransactionDiff).toFixed(2)}`;
    doc.text(moneyDiffStr, 186, startY + 20, { align: "right" });

    // Line 3: Unsettled Crops
    doc.text("Unsettled Crops", 20, startY + 28);
    doc.text(`Rs. ${summary.unsettledCropsTotal.toFixed(2)}`, 186, startY + 28, { align: "right" });

    // Line 4: Divider Line 1
    doc.setDrawColor(150);
    doc.setLineWidth(0.5);
    doc.line(20, startY + 34, 186, startY + 34);

    // Line 5: FINAL AMOUNT
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("FINAL AMOUNT", 20, startY + 43);
    const absFinal = Math.abs(summary.finalAmount);
    doc.text(`Rs. ${absFinal.toFixed(2)}`, 186, startY + 43, { align: "right" });

    // Line 6: Divider Line 2
    doc.line(20, startY + 48, 186, startY + 48);

    // Line 7: PAYABLE BY FARMER / PAYABLE TO FARMER
    doc.setFontSize(12);
    const isPayableByFarmer = summary.finalAmount >= 0;
    const resultLabel = isPayableByFarmer
      ? "PAYABLE BY FARMER"
      : "PAYABLE TO FARMER";

    if (isPayableByFarmer) {
      doc.setTextColor(192, 57, 43); // Red
    } else {
      doc.setTextColor(39, 174, 96); // Green
    }
    doc.text(resultLabel, 103, startY + 57, { align: "center" });

    return doc;
  };

  const handleExportPDF = () => {
    const doc = generatePDF();
    if (!doc) return;
    const pdfBlobUrl = doc.output("bloburl");
    window.open(pdfBlobUrl, "_blank");
  };

  const handleSettleAccount = async () => {
    if (!data) return;
    setSaving(true);

    try {
      // Save settlement to database and generate bill
      const res = await fetch(
        `/api/annual-settlement/${searchId.toUpperCase()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodStart: data.periodStart,
            periodEnd: data.periodEnd,
            status: "MANUALLY_SETTLED",
            shopPurchasesTotal: data.summary.shopPurchasesTotal,
            moneyTransactionDiff: data.summary.moneyTransactionDiff,
            unsettledCropsTotal: data.summary.unsettledCropsTotal,
            finalAmount: data.summary.finalAmount,
            totalPurchasesPrincipal: data.summary.totalPurchasesPrincipal,
            totalCashTakenPrincipal: data.summary.totalCashTakenPrincipal,
            totalCashGivenPrincipal: data.summary.totalCashGivenPrincipal,
            totalCotton: data.summary.totalCotton,
            totalMirchi: data.summary.totalMirchi,
            principal: data.summary.principal,
            interestRate: data.summary.interestRate,
            interestAmount: data.summary.interestAmount,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save settlement");
      }

      setSettled(true);
      setModalType("success");
      setModalTitle("Account Settled Successfully");
      setModalMessage(
        `Final Annual Settlement for ${data.farmer.name} has been processed! Settlement status set to Manually Settled.`
      );
      setModalOpen(true);

      // Open PDF automatically
      handleExportPDF();
    } catch (err: any) {
      setModalType("error");
      setModalTitle("Settlement Failed");
      setModalMessage(err.message);
      setModalOpen(true);
    } finally {
      setSaving(false);
    }
  };

  const s = data?.summary;

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col pt-8 pb-12 px-4">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-indigo-100 p-3 rounded-full">
          <FileText className="w-6 h-6 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">
            Final Year-End Settlement
          </h1>
          <p className="text-slate-500">
            Search farmer, calculate annual account with interest, and process settlement.
          </p>
        </div>
      </div>

      <AlertModal
        isOpen={modalOpen}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setModalOpen(false)}
      />

      {/* Search Section */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1 space-y-2">
            <label className="block text-sm font-medium text-slate-700">
              Enter Farmer ID
            </label>
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="e.g. F-001"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 h-[42px] rounded-lg font-medium transition-all disabled:opacity-70"
          >
            {loading ? (
              "Calculating..."
            ) : (
              <>
                <Search className="w-4 h-4" /> Fetch Account
              </>
            )}
          </button>
        </form>
        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        )}
      </div>

      {/* Results */}
      {data && (
        <div className="space-y-6 flex-1">
          {/* Farmer Info Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-slate-800">
                    {data.farmer.name}
                  </h2>
                  <span
                    className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
                      data.status === "MANUALLY_SETTLED"
                        ? "bg-green-100 text-green-800"
                        : data.status === "AUTOMATICALLY_SETTLED"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {data.status.replace("_", " ")}
                  </span>
                </div>
                <p className="text-slate-500 text-sm mt-1">
                  Farmer ID: <strong>{data.farmer.farmerNo}</strong> | Phone: {data.farmer.phone}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-500">Settlement Period</p>
                <p className="font-medium text-slate-700">
                  {format(new Date(data.periodStart), "dd/MM/yyyy")} →{" "}
                  {format(new Date(data.periodEnd), "dd/MM/yyyy")}
                </p>
              </div>
            </div>
          </div>

          {/* Breakdown Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 font-medium mb-1 text-sm">
                Shop Purchases (With Interest)
              </h3>
              <p className="text-2xl font-bold text-slate-800">
                ₹{s.shopPurchasesTotal.toFixed(2)}
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 font-medium mb-1 text-sm">
                Money Transaction Diff
              </h3>
              <p className="text-2xl font-bold text-indigo-600">
                ₹{s.moneyTransactionDiff.toFixed(2)}
              </p>
            </div>
            <div
              className={`p-5 rounded-xl border shadow-sm ${
                s.finalAmount >= 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"
              }`}
            >
              <h3 className="text-slate-500 font-medium mb-1 text-sm">
                {s.finalAmount >= 0
                  ? "FINAL AMOUNT (PAYABLE BY FARMER)"
                  : "FINAL AMOUNT (PAYABLE TO FARMER)"}
              </h3>
              <p
                className={`text-2xl font-bold ${
                  s.finalAmount >= 0 ? "text-red-700" : "text-green-700"
                }`}
              >
                ₹{Math.abs(s.finalAmount).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Detailed Account Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 font-semibold text-slate-800 flex justify-between">
              <span>Account Breakdown</span>
              <span className="text-xs text-slate-500 font-normal">
                * Cotton & Mirchi have NO interest applied
              </span>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-green-900 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Principal (₹)</th>
                  <th className="px-4 py-3 text-right">Interest (₹)</th>
                  <th className="px-4 py-3 text-right">Subtotal (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">Shop Purchases</td>
                  <td className="px-4 py-3 text-right">{s.totalPurchasesPrincipal.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">{s.totalPurchaseInterest.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium">{s.shopPurchasesTotal.toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">Money Taken (Borrowed)</td>
                  <td className="px-4 py-3 text-right">{s.totalCashTakenPrincipal.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">{s.totalCashTakenInterest.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium">{s.cashTakenTotal.toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-green-50/50">
                  <td className="px-4 py-3 font-medium text-green-700">Money Given (Repaid)</td>
                  <td className="px-4 py-3 text-right text-green-700">- {s.totalCashGivenPrincipal.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-green-600">- {s.totalCashGivenInterest.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">- {s.cashGivenTotal.toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-green-50/50">
                  <td className="px-4 py-3 font-medium text-green-700">Cotton Transactions (No Interest)</td>
                  <td className="px-4 py-3 text-right text-green-700">- {s.totalCotton.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-slate-400">0.00</td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">- {s.totalCotton.toFixed(2)}</td>
                </tr>
                <tr className="hover:bg-green-50/50">
                  <td className="px-4 py-3 font-medium text-green-700">Mirchi Transactions (No Interest)</td>
                  <td className="px-4 py-3 text-right text-green-700">- {s.totalMirchi.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-slate-400">0.00</td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">- {s.totalMirchi.toFixed(2)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-800 border-t border-slate-300">
                  <td className="px-4 py-3">FINAL NET AMOUNT</td>
                  <td className="px-4 py-3 text-right">{s.principal.toFixed(2)}</td>
                  <td className="px-4 py-3 text-right text-amber-600">{s.interestAmount.toFixed(2)}</td>
                  <td className={`px-4 py-3 text-right text-lg ${s.finalAmount >= 0 ? "text-red-700" : "text-green-700"}`}>
                    ₹{Math.abs(s.finalAmount).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Bottom Calculation Box Preview */}
          <div className="bg-slate-50 border border-slate-300 rounded-xl p-6 font-mono text-sm space-y-2 max-w-lg mx-auto shadow-inner">
            <div className="flex justify-between font-bold text-slate-700">
              <span>Shop Purchases</span>
              <span>₹{s.shopPurchasesTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-700">
              <span>Money Transaction Difference</span>
              <span>₹{s.moneyTransactionDiff.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-bold text-slate-700">
              <span>Unsettled Crops</span>
              <span>₹{s.unsettledCropsTotal.toFixed(2)}</span>
            </div>
            <hr className="border-slate-400 my-2" />
            <div className="flex justify-between text-base font-black text-slate-900">
              <span>FINAL AMOUNT</span>
              <span>₹{Math.abs(s.finalAmount).toFixed(2)}</span>
            </div>
            <hr className="border-slate-400 my-2" />
            <div className={`text-center font-black text-base ${s.finalAmount >= 0 ? "text-red-600" : "text-green-600"}`}>
              {s.finalAmount >= 0 ? "PAYABLE BY FARMER" : "PAYABLE TO FARMER"}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-4">
            <button
              onClick={handleExportPDF}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-green-950 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-md"
            >
              <Download className="w-5 h-5" /> Download Final PDF
            </button>

            <button
              onClick={handleSettleAccount}
              disabled={saving || settled}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-md disabled:opacity-50"
            >
              {settled ? (
                <>
                  <CheckCircle2 className="w-5 h-5" /> Account Settled
                </>
              ) : saving ? (
                "Processing..."
              ) : (
                <>
                  <ShieldCheck className="w-5 h-5" /> Settle Account
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
