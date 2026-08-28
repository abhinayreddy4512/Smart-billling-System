"use client";

import { useState } from "react";
import {
  Calculator,
  Search,
  Download,
  TrendingUp,
  FileText,
  Send,
  CheckCircle2,
  AlertCircle,
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
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generatePDF = () => {
    if (!data) return null;
    const { shopInfo, farmer, summary, periodStart, periodEnd } = data;

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
    doc.text("Farmer Details", 14, 50);
    doc.setFont("helvetica", "normal");
    doc.text(`Name: ${farmer.name}`, 14, 57);
    doc.text(`Farmer ID: ${farmer.farmerNo}`, 14, 63);
    doc.text(`Phone: ${farmer.phone}`, 14, 69);

    // Settlement Period
    doc.setFont("helvetica", "bold");
    doc.text("Settlement Period", 120, 50);
    doc.setFont("helvetica", "normal");
    doc.text(
      `From: ${format(new Date(periodStart), "dd/MM/yyyy")}`,
      120,
      57
    );
    doc.text(
      `To: ${format(new Date(periodEnd), "dd/MM/yyyy")}`,
      120,
      63
    );
    doc.text(
      `Generated: ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
      120,
      69
    );

    let startY = 80;

    // ---- Transaction Summary Table ----
    doc.setFontSize(13);
    doc.setTextColor(44, 62, 80);
    doc.setFont("helvetica", "bold");
    doc.text("Transaction Summary", 14, startY);
    startY += 5;

    autoTable(doc, {
      startY,
      head: [["Category", "Principal (Rs.)", "Interest (Rs.)", "Total (Rs.)"]],
      body: [
        [
          "Purchases (Pesticides + Fertilizers)",
          summary.totalPurchases.toFixed(2),
          summary.totalPurchaseInterest.toFixed(2),
          (summary.totalPurchases + summary.totalPurchaseInterest).toFixed(2),
        ],
        [
          "Cash Taken (Borrowed by Farmer)",
          summary.totalCashTaken.toFixed(2),
          summary.totalCashTakenInterest.toFixed(2),
          (summary.totalCashTaken + summary.totalCashTakenInterest).toFixed(2),
        ],
        [
          "Cash Given (Repaid by Farmer)",
          `- ${summary.totalCashGiven.toFixed(2)}`,
          `- ${summary.totalCashGivenInterest.toFixed(2)}`,
          `- ${(summary.totalCashGiven + summary.totalCashGivenInterest).toFixed(2)}`,
        ],
        [
          "Cotton Transactions",
          `- ${summary.totalCotton.toFixed(2)}`,
          `- ${summary.totalCottonInterest.toFixed(2)}`,
          `- ${(summary.totalCotton + summary.totalCottonInterest).toFixed(2)}`,
        ],
        [
          "Mirchi Transactions",
          `- ${summary.totalMirchi.toFixed(2)}`,
          `- ${summary.totalMirchiInterest.toFixed(2)}`,
          `- ${(summary.totalMirchi + summary.totalMirchiInterest).toFixed(2)}`,
        ],
      ],
      theme: "striped",
      headStyles: { fillColor: [21, 128, 61] },
      styles: { fontSize: 10 },
    });

    startY = (doc as any).lastAutoTable.finalY + 15;

    // ---- Interest Calculation Box ----
    if (startY > 220) {
      doc.addPage();
      startY = 20;
    }

    doc.setDrawColor(200);
    doc.setFillColor(245, 247, 250);
    doc.rect(14, startY, 182, 55, "FD");

    doc.setFontSize(13);
    doc.setTextColor(44, 62, 80);
    doc.setFont("helvetica", "bold");
    doc.text("Final Calculation", 18, startY + 10);

    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    doc.text(
      `Outstanding Principal: Rs. ${summary.principal.toFixed(2)}`,
      18,
      startY + 20
    );
    doc.text(
      `Interest Rate: ${summary.interestRate}% per month`,
      18,
      startY + 27
    );
    doc.text(
      `Total Interest: Rs. ${summary.interestAmount.toFixed(2)}`,
      18,
      startY + 34
    );

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    if (summary.totalAmount >= 0) {
      doc.setTextColor(192, 57, 43);
      doc.text(
        `Amount Payable by Farmer: Rs. ${summary.totalAmount.toFixed(2)}`,
        18,
        startY + 46
      );
    } else {
      doc.setTextColor(39, 174, 96);
      doc.text(
        `Amount Payable by Shop: Rs. ${Math.abs(summary.totalAmount).toFixed(2)}`,
        18,
        startY + 46
      );
    }

    return doc;
  };

  const handleExportPDF = () => {
    const doc = generatePDF();
    if (!doc) return;
    const pdfBlobUrl = doc.output("bloburl");
    window.open(pdfBlobUrl, "_blank");
  };

  const handleSaveSettlement = async () => {
    if (!data) return;
    setSaving(true);

    try {
      // Save to database
      const res = await fetch(
        `/api/annual-settlement/${searchId.toUpperCase()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            periodStart: data.periodStart,
            periodEnd: data.periodEnd,
            totalPurchases: data.summary.totalPurchases,
            totalCashTaken: data.summary.totalCashTaken,
            totalCashGiven: data.summary.totalCashGiven,
            totalCotton: data.summary.totalCotton,
            totalMirchi: data.summary.totalMirchi,
            principal: data.summary.principal,
            interestRate: data.summary.interestRate,
            interestAmount: data.summary.interestAmount,
            totalAmount: data.summary.totalAmount,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save settlement");
      }

      // Generate PDF and send email if farmer has email
      try {
        const doc = generatePDF();
        if (doc && data.farmer.email) {
          const pdfBase64 = doc.output("datauristring");
          const html = `
            <h2 style="color: #15803d;">Greetings From Sri Abhinaya Fertilizers</h2>
            <p><strong>Customer Name:</strong> ${data.farmer.name}</p>
            <p><strong>Customer ID:</strong> ${data.farmer.farmerNo}</p>
            <p><strong>Phone:</strong> ${data.farmer.phone}</p>
            <br/>
            <h3>Annual Final Settlement Statement</h3>
            <p><strong>Settlement Period:</strong> ${format(new Date(data.periodStart), "dd/MM/yyyy")} to ${format(new Date(data.periodEnd), "dd/MM/yyyy")}</p>
            <br/>
            <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
              <tr style="background-color: #15803d; color: white;">
                <th>Category</th><th>Principal</th><th>Interest</th><th>Total</th>
              </tr>
              <tr>
                <td>Purchases</td>
                <td align="right">Rs. ${data.summary.totalPurchases.toFixed(2)}</td>
                <td align="right">Rs. ${data.summary.totalPurchaseInterest.toFixed(2)}</td>
                <td align="right">Rs. ${(data.summary.totalPurchases + data.summary.totalPurchaseInterest).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Cash Taken</td>
                <td align="right">Rs. ${data.summary.totalCashTaken.toFixed(2)}</td>
                <td align="right">Rs. ${data.summary.totalCashTakenInterest.toFixed(2)}</td>
                <td align="right">Rs. ${(data.summary.totalCashTaken + data.summary.totalCashTakenInterest).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Cash Given</td>
                <td align="right">- Rs. ${data.summary.totalCashGiven.toFixed(2)}</td>
                <td align="right">- Rs. ${data.summary.totalCashGivenInterest.toFixed(2)}</td>
                <td align="right">- Rs. ${(data.summary.totalCashGiven + data.summary.totalCashGivenInterest).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Cotton</td>
                <td align="right">- Rs. ${data.summary.totalCotton.toFixed(2)}</td>
                <td align="right">- Rs. ${data.summary.totalCottonInterest.toFixed(2)}</td>
                <td align="right">- Rs. ${(data.summary.totalCotton + data.summary.totalCottonInterest).toFixed(2)}</td>
              </tr>
              <tr>
                <td>Mirchi</td>
                <td align="right">- Rs. ${data.summary.totalMirchi.toFixed(2)}</td>
                <td align="right">- Rs. ${data.summary.totalMirchiInterest.toFixed(2)}</td>
                <td align="right">- Rs. ${(data.summary.totalMirchi + data.summary.totalMirchiInterest).toFixed(2)}</td>
              </tr>
            </table>
            <br/>
            <p><strong>Outstanding Principal:</strong> Rs. ${data.summary.principal.toFixed(2)}</p>
            <p><strong>Interest Rate:</strong> ${data.summary.interestRate}% per month</p>
            <p><strong>Total Interest:</strong> Rs. ${data.summary.interestAmount.toFixed(2)}</p>
            <h3><strong>Final Amount: Rs. ${data.summary.totalAmount.toFixed(2)}</strong></h3>
            <p>${data.summary.totalAmount >= 0 ? "Amount payable by Farmer" : "Amount payable by Shop"}</p>
            <br/>
            <p>Please find your detailed settlement statement attached as a PDF.</p>
          `;

          await fetch("/api/email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: data.farmer.email,
              subject: `Annual Settlement - ${format(new Date(data.periodStart), "yyyy")}/${format(new Date(data.periodEnd), "yyyy")}`,
              html,
              pdfBase64,
              fileName: `Annual_Settlement_${data.farmer.farmerNo}_${format(new Date(data.periodEnd), "yyyy")}.pdf`,
            }),
          });
        }
      } catch (emailErr) {
        console.error("Email sending failed:", emailErr);
      }

      setSettled(true);
      setModalType("success");
      setModalTitle("Settlement Saved");
      setModalMessage(
        `Annual settlement for ${data.farmer.name} has been recorded successfully!${data.farmer.email ? " Email sent." : ""}`
      );
      setModalOpen(true);
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
            Annual Final Settlement
          </h1>
          <p className="text-slate-500">
            Calculate yearly settlement with interest and generate the final
            statement.
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
                <Search className="w-4 h-4" /> Search
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
                <h2 className="text-xl font-bold text-slate-800">
                  {data.farmer.name}
                </h2>
                <p className="text-slate-500 text-sm">
                  ID: {data.farmer.farmerNo} | Phone: {data.farmer.phone}
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

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 font-medium mb-2 text-sm">
                Outstanding Principal
              </h3>
              <p className="text-2xl font-bold text-slate-800">
                ₹{s.principal.toFixed(2)}
              </p>
            </div>
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
              <h3 className="text-slate-500 font-medium mb-2 text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-orange-500" /> Total
                Interest ({s.interestRate}%/mo)
              </h3>
              <p className="text-2xl font-bold text-orange-600">
                ₹{s.interestAmount.toFixed(2)}
              </p>
            </div>
            <div
              className={`p-5 rounded-xl border shadow-sm ${s.totalAmount >= 0 ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}
            >
              <h3 className="text-slate-500 font-medium mb-2 text-sm">
                {s.totalAmount >= 0
                  ? "Amount Payable by Farmer"
                  : "Amount Payable by Shop"}
              </h3>
              <p
                className={`text-2xl font-bold ${s.totalAmount >= 0 ? "text-red-700" : "text-green-700"}`}
              >
                ₹{Math.abs(s.totalAmount).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Breakdown Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-green-900 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Category</th>
                  <th className="px-4 py-3 text-right">Principal (₹)</th>
                  <th className="px-4 py-3 text-right">Interest (₹)</th>
                  <th className="px-4 py-3 text-right">Total (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">
                    Purchases (Pesticides + Fertilizers)
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.totalPurchases.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-600">
                    {s.totalPurchaseInterest.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {(s.totalPurchases + s.totalPurchaseInterest).toFixed(2)}
                  </td>
                </tr>
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">
                    Cash Taken (Borrowed)
                  </td>
                  <td className="px-4 py-3 text-right">
                    {s.totalCashTaken.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-600">
                    {s.totalCashTakenInterest.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {(s.totalCashTaken + s.totalCashTakenInterest).toFixed(2)}
                  </td>
                </tr>
                <tr className="hover:bg-green-50/50">
                  <td className="px-4 py-3 font-medium text-green-700">
                    Cash Given (Repaid)
                  </td>
                  <td className="px-4 py-3 text-right text-green-700">
                    - {s.totalCashGiven.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    - {s.totalCashGivenInterest.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">
                    -{" "}
                    {(s.totalCashGiven + s.totalCashGivenInterest).toFixed(2)}
                  </td>
                </tr>
                <tr className="hover:bg-green-50/50">
                  <td className="px-4 py-3 font-medium text-green-700">
                    Cotton Transactions
                  </td>
                  <td className="px-4 py-3 text-right text-green-700">
                    - {s.totalCotton.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    - {s.totalCottonInterest.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">
                    - {(s.totalCotton + s.totalCottonInterest).toFixed(2)}
                  </td>
                </tr>
                <tr className="hover:bg-green-50/50">
                  <td className="px-4 py-3 font-medium text-green-700">
                    Mirchi Transactions
                  </td>
                  <td className="px-4 py-3 text-right text-green-700">
                    - {s.totalMirchi.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-green-600">
                    - {s.totalMirchiInterest.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-green-700">
                    - {(s.totalMirchi + s.totalMirchiInterest).toFixed(2)}
                  </td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 font-bold text-slate-800">
                  <td className="px-4 py-3">FINAL TOTAL</td>
                  <td className="px-4 py-3 text-right">
                    {s.principal.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-orange-600">
                    {s.interestAmount.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-right text-lg">
                    {s.totalAmount >= 0 ? "" : "- "}₹
                    {Math.abs(s.totalAmount).toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Past Settlements */}
          {data.pastSettlements && data.pastSettlements.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-3">
                Previous Annual Settlements
              </h3>
              <ul className="space-y-2">
                {data.pastSettlements.map((ps: any) => (
                  <li
                    key={ps.id}
                    className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-lg text-sm"
                  >
                    <span className="text-slate-600">
                      {format(new Date(ps.periodStart), "dd/MM/yyyy")} →{" "}
                      {format(new Date(ps.periodEnd), "dd/MM/yyyy")}
                    </span>
                    <span className="font-bold text-slate-800">
                      ₹{ps.totalAmount.toFixed(2)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col md:flex-row gap-4">
            <button
              onClick={handleExportPDF}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-800 hover:bg-green-950 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-md"
            >
              <Download className="w-5 h-5" /> Download PDF
            </button>
            <button
              onClick={handleSaveSettlement}
              disabled={saving || settled}
              className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-md disabled:opacity-50"
            >
              {settled ? (
                <>
                  <CheckCircle2 className="w-5 h-5" /> Settlement Saved
                </>
              ) : saving ? (
                "Saving..."
              ) : (
                <>
                  <Send className="w-5 h-5" /> Save & Send Settlement
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
