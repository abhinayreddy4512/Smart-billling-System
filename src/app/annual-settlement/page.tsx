"use client";

import { useState } from "react";
import {
  FileText,
  Search,
  Download,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Calendar,
  CreditCard,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { AlertModal } from "@/components/ui/AlertModal";

// ─── Types ──────────────────────────────────────────────────────────────────
type DecisionState = "NONE" | "CHOOSING" | "DECIDED";

export default function AnnualSettlementPage() {
  const [searchId, setSearchId] = useState("");
  const [settlementDate, setSettlementDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  // Settlement save state
  const [settling, setSettling] = useState(false);
  const [settlementId, setSettlementId] = useState<string | null>(null);
  const [decisionState, setDecisionState] = useState<DecisionState>("NONE");
  const [decisionResult, setDecisionResult] = useState<string>("");

  // Expand/collapse sections
  const [expandedSections, setExpandedSections] = useState({
    pesticides: true,
    fertilizers: true,
    unsettledCrops: true,
    settledCrops: false,
    moneyTaken: true,
    moneyGiven: true,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"success" | "error">("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Fetch / Recalculate ────────────────────────────────────────────────
  const fetchSettlement = async (farmerId: string, date: string) => {
    if (!farmerId) return;
    setLoading(true);
    setError("");
    setData(null);
    setSettlementId(null);
    setDecisionState("NONE");
    setDecisionResult("");

    try {
      const res = await fetch(
        `/api/annual-settlement/${farmerId.toUpperCase()}?settlementDate=${date}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to calculate settlement");
      }
      const result = await res.json();
      setData(result);

      // If already settled, set the existing settlement ID and decision state
      if (result.isAlreadySettled) {
        setSettlementId(result.existingSettlementId);
        setDecisionState(
          result.paymentStatus === "PENDING_DECISION" ? "CHOOSING" : "DECIDED"
        );
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSettlement(searchId, settlementDate);
  };

  const handleDateChange = (newDate: string) => {
    setSettlementDate(newDate);
    if (searchId && data) {
      fetchSettlement(searchId, newDate);
    }
  };

  // ─── Step 1: Settle Account (records to DB, awaits decision) ───────────
  const handleSettleAccount = async () => {
    if (!data) return;
    setSettling(true);
    try {
      const res = await fetch(`/api/annual-settlement/${searchId.toUpperCase()}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          academicYear: data.academicYear,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          settlementDate,
          status: "MANUALLY_SETTLED",
          summary: data.summary,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to settle account");
      }
      const result = await res.json();
      setSettlementId(result.settlement.id);
      setDecisionState("CHOOSING");
    } catch (err: any) {
      setModalType("error");
      setModalTitle("Settlement Failed");
      setModalMessage(err.message);
      setModalOpen(true);
    } finally {
      setSettling(false);
    }
  };

  // ─── Step 2: Paid / Carry Forward decision ──────────────────────────────
  const handleDecision = async (decision: "PAID" | "CARRY_FORWARD") => {
    if (!settlementId || !data) return;
    setSettling(true);
    try {
      const res = await fetch(
        `/api/annual-settlement/${searchId.toUpperCase()}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settlementId,
            decision,
            finalAmount: data.summary.finalAmount,
            settlementDate,
            academicYear: data.academicYear,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to process decision");
      }
      const result = await res.json();
      setDecisionState("DECIDED");
      setDecisionResult(result.message);
      setModalType("success");
      setModalTitle(
        decision === "PAID"
          ? "✅ Payment Recorded"
          : "↗️ Balance Carried Forward"
      );
      setModalMessage(result.message);
      setModalOpen(true);

      // Auto-export PDF on successful settlement
      handleExportPDF();
    } catch (err: any) {
      setModalType("error");
      setModalTitle("Decision Failed");
      setModalMessage(err.message);
      setModalOpen(true);
    } finally {
      setSettling(false);
    }
  };

  // ─── PDF Generation ──────────────────────────────────────────────────────
  const generatePDF = () => {
    if (!data) return null;
    const { shopInfo, farmer, summary, academicYear, periodStart, status } = data;

    const doc = new jsPDF();
    let y = 15;

    // ── Header ──
    const shopName = shopInfo?.shopName || "SMART BILLING";
    doc.setFontSize(22);
    doc.setTextColor(21, 128, 61);
    doc.setFont("helvetica", "bold");
    doc.text(shopName.toUpperCase(), 105, y, { align: "center" });
    y += 7;

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    doc.text("Pesticides, Seeds & Fertilizers", 105, y, { align: "center" });
    y += 6;

    doc.setFontSize(15);
    doc.setTextColor(44, 62, 80);
    doc.setFont("helvetica", "bold");
    doc.text("ANNUAL FINAL SETTLEMENT", 105, y, { align: "center" });
    y += 5;

    doc.setDrawColor(21, 128, 61);
    doc.setLineWidth(0.6);
    doc.line(14, y, 196, y);
    y += 8;

    // ── Farmer & Year Info ──
    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(`Farmer: ${farmer.name}`, 14, y);
    doc.text(`Academic Year: ${academicYear}`, 130, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Farmer ID: ${farmer.farmerNo}   Phone: ${farmer.phone}`, 14, y);
    doc.text(`Settlement Date: ${format(new Date(settlementDate), "dd/MM/yyyy")}`, 130, y);
    y += 6;
    doc.text(`Period: ${format(new Date(periodStart), "dd/MM/yyyy")} → ${format(new Date(settlementDate), "dd/MM/yyyy")}`, 14, y);
    doc.text(`Status: ${status.replace(/_/g, " ")}`, 130, y);
    y += 8;

    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(14, y, 196, y);
    y += 8;

    // ── Helper: render section ──
    const renderSection = (
      title: string,
      items: any[],
      columns: string[],
      rowFn: (item: any) => string[],
      headerColor: [number, number, number],
      totalLabel: string,
      totalValue: number
    ) => {
      if (items.length === 0) return;
      if (y > 230) { doc.addPage(); y = 15; }

      doc.setFontSize(11);
      doc.setTextColor(44, 62, 80);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [columns],
        body: items.map(rowFn),
        theme: "striped",
        headStyles: { fillColor: headerColor, fontSize: 8.5 },
        bodyStyles: { fontSize: 8.5 },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 3;

      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(44, 62, 80);
      doc.text(`${totalLabel}: Rs. ${totalValue.toFixed(2)}`, 182, y, { align: "right" });
      y += 10;
    };

    const fmtDate = (d: any) => format(new Date(d), "dd/MM/yy");

    // 1. Pesticides
    renderSection(
      "1. Pesticides",
      data.pesticides,
      ["Bill No", "Date", "Product", "Principal (Rs)", "Interest (Rs)", "Total (Rs)"],
      (i) => [
        String(i.billNo || "-"),
        fmtDate(i.date),
        i.product,
        i.total.toFixed(2),
        i.interest.toFixed(2),
        i.finalAmount.toFixed(2),
      ],
      [192, 57, 43],
      "Pesticide Total",
      summary.pesticidesTotal
    );

    // 2. Fertilizers
    renderSection(
      "2. Fertilizers",
      data.fertilizers,
      ["Bill No", "Date", "Product", "Principal (Rs)", "Interest (Rs)", "Total (Rs)"],
      (i) => [
        String(i.billNo || "-"),
        fmtDate(i.date),
        i.product,
        i.total.toFixed(2),
        i.interest.toFixed(2),
        i.finalAmount.toFixed(2),
      ],
      [41, 128, 185],
      "Fertilizer Total",
      summary.fertilizersTotal
    );

    // 3. Unsettled Crops
    renderSection(
      "3. Unsettled Crops (Included in Calculation — No Interest)",
      data.unsettledCrops,
      ["Log No", "Date", "Crop Type", "Weight (qtl)", "Price/qtl (Rs)", "Amount (Rs)"],
      (i) => [
        String(i.logNo || "-"),
        fmtDate(i.date),
        i.cropType,
        (i.totalWeight / 100).toFixed(2),
        (i.price || 0).toFixed(2),
        i.amount.toFixed(2),
      ],
      [39, 174, 96],
      "Unsettled Crops Total",
      summary.unsettledCropsTotal
    );

    // 4. Settled Crops (Record Only)
    if (data.settledCropsForRecord.length > 0) {
      if (y > 230) { doc.addPage(); y = 15; }
      doc.setFontSize(11);
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "bold");
      doc.text("4. Settled Crops — For Record Only (NOT Included in Calculation)", 14, y);
      y += 5;

      autoTable(doc, {
        startY: y,
        head: [["Log No", "Date", "Crop Type", "Weight (qtl)", "Amount (Rs)", "Status"]],
        body: data.settledCropsForRecord.map((i: any) => [
          String(i.logNo || "-"),
          fmtDate(i.date),
          i.cropType,
          (i.totalWeight / 100).toFixed(2),
          i.amount.toFixed(2),
          "SETTLED ✓",
        ]),
        theme: "grid",
        headStyles: { fillColor: [149, 165, 166], fontSize: 8.5 },
        bodyStyles: { fontSize: 8.5, textColor: [120, 120, 120] },
        margin: { left: 14, right: 14 },
      });
      y = (doc as any).lastAutoTable.finalY + 3;
      doc.setFontSize(8.5);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(150);
      doc.text("* Settled crops are shown for audit purposes only and do not affect the final calculation.", 14, y);
      y += 10;
    }

    // 5. Money Taken
    renderSection(
      "5. Money Taken (Farmer Borrowed / Shop Loaned)",
      data.moneyTaken,
      ["Receipt No", "Date", "Note", "Principal (Rs)", "Interest (Rs)", "Total (Rs)"],
      (i) => [
        String(i.receiptNo || "-"),
        fmtDate(i.date),
        i.note || "Cash Taken",
        i.amount.toFixed(2),
        i.interest.toFixed(2),
        i.finalAmount.toFixed(2),
      ],
      [211, 84, 0],
      "Money Taken Total",
      summary.cashTakenTotal
    );

    // 6. Money Given
    renderSection(
      "6. Money Given (Farmer Repaid / Shop Paid Farmer)",
      data.moneyGiven,
      ["Receipt No", "Date", "Note", "Principal (Rs)", "Interest (Rs)", "Total (Rs)"],
      (i) => [
        String(i.receiptNo || "-"),
        fmtDate(i.date),
        i.note || "Cash Given",
        i.amount.toFixed(2),
        i.interest.toFixed(2),
        i.finalAmount.toFixed(2),
      ],
      [39, 100, 174],
      "Money Given Total",
      summary.cashGivenTotal
    );

    // ── Bottom Calculation Box ──
    if (y > 200) { doc.addPage(); y = 15; }

    doc.setDrawColor(180);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, y, 182, 90, "FD");

    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.setFont("helvetica", "bold");

    const boxX = 20;
    const valX = 186;

    doc.text("Pesticides", boxX, y + 10);
    doc.text(`Rs. ${summary.pesticidesTotal.toFixed(2)}`, valX, y + 10, { align: "right" });

    doc.text("Fertilizers", boxX, y + 17);
    doc.text(`Rs. ${summary.fertilizersTotal.toFixed(2)}`, valX, y + 17, { align: "right" });

    doc.text("Unsettled Crops", boxX, y + 24);
    doc.text(`Rs. ${summary.unsettledCropsTotal.toFixed(2)}`, valX, y + 24, { align: "right" });

    doc.setDrawColor(180);
    doc.setLineWidth(0.4);
    doc.line(boxX, y + 28, valX, y + 28);

    doc.setFontSize(10.5);
    doc.text("Total Outstanding", boxX, y + 35);
    doc.text(`Rs. ${summary.totalOutstanding.toFixed(2)}`, valX, y + 35, { align: "right" });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Money Taken", boxX, y + 45);
    doc.text(`Rs. ${summary.cashTakenTotal.toFixed(2)}`, valX, y + 45, { align: "right" });
    doc.text("Money Given", boxX, y + 52);
    doc.text(`- Rs. ${summary.cashGivenTotal.toFixed(2)}`, valX, y + 52, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.line(boxX, y + 56, valX, y + 56);
    doc.text("Net Balance", boxX, y + 63);
    doc.text(`Rs. ${summary.netMoneyBalance.toFixed(2)}`, valX, y + 63, { align: "right" });

    doc.line(boxX, y + 67, valX, y + 67);

    // Final result
    const fa = summary.finalAmount;
    doc.setFontSize(12);
    if (Math.abs(fa) < 0.01) {
      doc.setTextColor(21, 128, 61);
      doc.text("✅ ACCOUNT FULLY SETTLED — Rs. 0.00", 105, y + 77, { align: "center" });
    } else if (fa > 0) {
      doc.setTextColor(192, 57, 43);
      doc.text(`🔴 FARMER HAS TO PAY ADMIN`, 105, y + 74, { align: "center" });
      doc.setFontSize(14);
      doc.text(`Rs. ${fa.toFixed(2)}`, 105, y + 82, { align: "center" });
    } else {
      doc.setTextColor(21, 128, 61);
      doc.text(`🟢 ADMIN HAS TO PAY FARMER`, 105, y + 74, { align: "center" });
      doc.setFontSize(14);
      doc.text(`Rs. ${Math.abs(fa).toFixed(2)}`, 105, y + 82, { align: "center" });
    }

    return doc;
  };

  const handleExportPDF = () => {
    const doc = generatePDF();
    if (!doc) return;
    window.open(doc.output("bloburl"), "_blank");
  };

  const s = data?.summary;

  // ─── Helper: Section header ──────────────────────────────────────────────
  const SectionHeader = ({
    title,
    count,
    total,
    sectionKey,
    color = "slate",
  }: {
    title: string;
    count: number;
    total: number;
    sectionKey: keyof typeof expandedSections;
    color?: string;
  }) => (
    <button
      onClick={() => toggleSection(sectionKey)}
      className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-all"
    >
      <div className="flex items-center gap-3">
        <span className="font-semibold text-slate-700">{title}</span>
        <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full">
          {count} {count === 1 ? "entry" : "entries"}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span className="font-bold text-slate-800">₹{total.toFixed(2)}</span>
        {expandedSections[sectionKey] ? (
          <ChevronUp className="w-4 h-4 text-slate-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-slate-500" />
        )}
      </div>
    </button>
  );

  // ─── Helper: Transaction Table ───────────────────────────────────────────
  const TransactionTable = ({
    items,
    columns,
    rowRenderer,
  }: {
    items: any[];
    columns: string[];
    rowRenderer: (item: any) => React.ReactNode;
  }) => (
    <div className="overflow-x-auto border border-slate-200 rounded-b-xl">
      <table className="w-full text-xs">
        <thead>
          <tr className="bg-slate-100 text-slate-600">
            {columns.map((col) => (
              <th key={col} className="px-3 py-2 text-left font-semibold">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {items.map((item, idx) => (
            <tr key={idx} className="hover:bg-slate-50">
              {rowRenderer(item)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const td = (val: string, cls = "") => (
    <td className={`px-3 py-2 ${cls}`}>{val}</td>
  );

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col pt-8 pb-16 px-4">
      {/* Page Title */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-indigo-100 p-3 rounded-full">
          <FileText className="w-6 h-6 text-indigo-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">Annual Final Settlement</h1>
          <p className="text-slate-500 text-sm">
            Academic Year: 1 Jun → 31 May | Interest calculated up to settlement date
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

      {/* ── Search Panel ─────────────────────────────────────────────────── */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <form
          onSubmit={handleSearch}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end"
        >
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700">Farmer ID</label>
            <input
              type="text"
              value={searchId}
              onChange={(e) => setSearchId(e.target.value)}
              placeholder="e.g. F-001"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-indigo-600" /> Settlement Date
            </label>
            <input
              type="date"
              value={settlementDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 h-[42px] rounded-lg font-medium transition-all disabled:opacity-70"
          >
            {loading ? "Calculating..." : <><Search className="w-4 h-4" /> Calculate Account</>}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" /> {error}
          </div>
        )}
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {data && s && (
        <div className="space-y-5">
          {/* Farmer & Period Info */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col md:flex-row justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold text-slate-800">{data.farmer.name}</h2>
                <span className="text-xs bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-bold">
                  AY {data.academicYear}
                </span>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-bold uppercase ${
                    data.status === "MANUALLY_SETTLED"
                      ? "bg-green-100 text-green-800"
                      : data.status === "AUTOMATICALLY_SETTLED"
                      ? "bg-blue-100 text-blue-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {data.status.replace(/_/g, " ")}
                </span>
              </div>
              <p className="text-slate-500 text-sm mt-1">
                ID: <strong>{data.farmer.farmerNo}</strong> | Phone: {data.farmer.phone}
              </p>
              <p className="text-slate-400 text-xs mt-1">
                Period: {format(new Date(data.periodStart), "dd/MM/yyyy")} →{" "}
                {format(new Date(data.periodEnd), "dd/MM/yyyy")}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">Interest calculated till</p>
              <p className="font-bold text-indigo-700 text-lg">
                {format(new Date(settlementDate), "dd/MM/yyyy")}
              </p>
            </div>
          </div>

          {/* ── Section 1: Pesticides ──────────────────────────────────── */}
          <div className="space-y-0">
            <SectionHeader
              title="1. Pesticides"
              count={data.pesticides.length}
              total={s.pesticidesTotal}
              sectionKey="pesticides"
            />
            {expandedSections.pesticides && data.pesticides.length > 0 && (
              <TransactionTable
                items={data.pesticides}
                columns={["Bill No", "Date", "Product", "Principal (₹)", "Interest (₹)", "Total (₹)"]}
                rowRenderer={(i) => (
                  <>
                    {td(String(i.billNo || "-"))}
                    {td(format(new Date(i.date), "dd/MM/yyyy"))}
                    {td(i.product)}
                    {td(i.total.toFixed(2))}
                    {td(i.interest.toFixed(2), "text-amber-600")}
                    {td(i.finalAmount.toFixed(2), "font-semibold")}
                  </>
                )}
              />
            )}
            {expandedSections.pesticides && data.pesticides.length === 0 && (
              <p className="text-sm text-slate-400 px-4 py-3 border border-t-0 border-slate-200 rounded-b-xl">No pesticide purchases this year.</p>
            )}
          </div>

          {/* ── Section 2: Fertilizers ─────────────────────────────────── */}
          <div className="space-y-0">
            <SectionHeader
              title="2. Fertilizers"
              count={data.fertilizers.length}
              total={s.fertilizersTotal}
              sectionKey="fertilizers"
            />
            {expandedSections.fertilizers && data.fertilizers.length > 0 && (
              <TransactionTable
                items={data.fertilizers}
                columns={["Bill No", "Date", "Product", "Principal (₹)", "Interest (₹)", "Total (₹)"]}
                rowRenderer={(i) => (
                  <>
                    {td(String(i.billNo || "-"))}
                    {td(format(new Date(i.date), "dd/MM/yyyy"))}
                    {td(i.product)}
                    {td(i.total.toFixed(2))}
                    {td(i.interest.toFixed(2), "text-amber-600")}
                    {td(i.finalAmount.toFixed(2), "font-semibold")}
                  </>
                )}
              />
            )}
            {expandedSections.fertilizers && data.fertilizers.length === 0 && (
              <p className="text-sm text-slate-400 px-4 py-3 border border-t-0 border-slate-200 rounded-b-xl">No fertilizer purchases this year.</p>
            )}
          </div>

          {/* ── Section 3: Unsettled Crops ─────────────────────────────── */}
          <div className="space-y-0">
            <SectionHeader
              title="3. Unsettled Crops (No Interest — Included in Calculation)"
              count={data.unsettledCrops.length}
              total={s.unsettledCropsTotal}
              sectionKey="unsettledCrops"
            />
            {expandedSections.unsettledCrops && data.unsettledCrops.length > 0 && (
              <TransactionTable
                items={data.unsettledCrops}
                columns={["Log No", "Date", "Crop Type", "Weight (qtl)", "Price/qtl (₹)", "Amount (₹)"]}
                rowRenderer={(i) => (
                  <>
                    {td(String(i.logNo || "-"))}
                    {td(format(new Date(i.date), "dd/MM/yyyy"))}
                    {td(i.cropType)}
                    {td((i.totalWeight / 100).toFixed(2))}
                    {td((i.price || 0).toFixed(2))}
                    {td(i.amount.toFixed(2), "font-semibold")}
                  </>
                )}
              />
            )}
            {expandedSections.unsettledCrops && data.unsettledCrops.length === 0 && (
              <p className="text-sm text-slate-400 px-4 py-3 border border-t-0 border-slate-200 rounded-b-xl">No unsettled crops.</p>
            )}
          </div>

          {/* ── Section 4: Settled Crops (Record Only) ─────────────────── */}
          {data.settledCropsForRecord.length > 0 && (
            <div className="space-y-0 opacity-70">
              <button
                onClick={() => toggleSection("settledCrops")}
                className="w-full flex items-center justify-between p-4 bg-slate-100 hover:bg-slate-200 border border-slate-300 border-dashed rounded-xl transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-slate-500">
                    4. Settled Crops — For Record Only
                  </span>
                  <span className="text-xs bg-slate-300 text-slate-500 px-2 py-0.5 rounded-full">
                    {data.settledCropsForRecord.length} entries
                  </span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                    NOT in calculation
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-bold text-slate-400">
                    ₹{s.settledCropsTotal.toFixed(2)}
                  </span>
                  {expandedSections.settledCrops ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </button>
              {expandedSections.settledCrops && (
                <TransactionTable
                  items={data.settledCropsForRecord}
                  columns={["Log No", "Date", "Crop Type", "Weight (qtl)", "Amount (₹)", "Status"]}
                  rowRenderer={(i) => (
                    <>
                      {td(String(i.logNo || "-"), "text-slate-400")}
                      {td(format(new Date(i.date), "dd/MM/yyyy"), "text-slate-400")}
                      {td(i.cropType, "text-slate-400")}
                      {td((i.totalWeight / 100).toFixed(2), "text-slate-400")}
                      {td(i.amount.toFixed(2), "text-slate-400 line-through")}
                      {td("SETTLED ✓", "text-green-600 font-semibold")}
                    </>
                  )}
                />
              )}
            </div>
          )}

          {/* ── Section 5: Money Taken ─────────────────────────────────── */}
          <div className="space-y-0">
            <SectionHeader
              title="5. Money Taken (Farmer Borrowed)"
              count={data.moneyTaken.length}
              total={s.cashTakenTotal}
              sectionKey="moneyTaken"
            />
            {expandedSections.moneyTaken && data.moneyTaken.length > 0 && (
              <TransactionTable
                items={data.moneyTaken}
                columns={["Receipt No", "Date", "Note", "Principal (₹)", "Interest (₹)", "Total (₹)"]}
                rowRenderer={(i) => (
                  <>
                    {td(String(i.receiptNo || "-"))}
                    {td(format(new Date(i.date), "dd/MM/yyyy"))}
                    {td(i.note || "Cash Taken", "text-slate-500")}
                    {td(i.amount.toFixed(2))}
                    {td(i.interest.toFixed(2), "text-amber-600")}
                    {td(i.finalAmount.toFixed(2), "font-semibold")}
                  </>
                )}
              />
            )}
            {expandedSections.moneyTaken && data.moneyTaken.length === 0 && (
              <p className="text-sm text-slate-400 px-4 py-3 border border-t-0 border-slate-200 rounded-b-xl">No money taken transactions.</p>
            )}
          </div>

          {/* ── Section 6: Money Given ─────────────────────────────────── */}
          <div className="space-y-0">
            <SectionHeader
              title="6. Money Given (Farmer Repaid / Admin Paid)"
              count={data.moneyGiven.length}
              total={s.cashGivenTotal}
              sectionKey="moneyGiven"
            />
            {expandedSections.moneyGiven && data.moneyGiven.length > 0 && (
              <TransactionTable
                items={data.moneyGiven}
                columns={["Receipt No", "Date", "Note", "Principal (₹)", "Interest (₹)", "Total (₹)"]}
                rowRenderer={(i) => (
                  <>
                    {td(String(i.receiptNo || "-"))}
                    {td(format(new Date(i.date), "dd/MM/yyyy"))}
                    {td(i.note || "Cash Given", "text-slate-500")}
                    {td(i.amount.toFixed(2))}
                    {td(i.interest.toFixed(2), "text-green-600")}
                    {td(i.finalAmount.toFixed(2), "font-semibold text-green-700")}
                  </>
                )}
              />
            )}
            {expandedSections.moneyGiven && data.moneyGiven.length === 0 && (
              <p className="text-sm text-slate-400 px-4 py-3 border border-t-0 border-slate-200 rounded-b-xl">No money given transactions.</p>
            )}
          </div>

          {/* ── Final Calculation Box ──────────────────────────────────── */}
          <div className="bg-slate-50 border border-slate-300 rounded-2xl p-6 font-mono text-sm space-y-1 shadow-inner">
            <div className="flex justify-between text-slate-700">
              <span>Pesticides</span>
              <span>₹{s.pesticidesTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Fertilizers</span>
              <span>₹{s.fertilizersTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-700">
              <span>Unsettled Crops</span>
              <span>₹{s.unsettledCropsTotal.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-400 my-1 pt-1 flex justify-between font-black text-slate-900">
              <span>Total Outstanding</span>
              <span>₹{s.totalOutstanding.toFixed(2)}</span>
            </div>

            <div className="pt-2 flex justify-between text-slate-600">
              <span>Money Taken</span>
              <span>₹{s.cashTakenTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Money Given</span>
              <span>- ₹{s.cashGivenTotal.toFixed(2)}</span>
            </div>
            <div className="border-t border-slate-400 my-1 pt-1 flex justify-between font-black text-slate-900">
              <span>Net Balance</span>
              <span>₹{s.netMoneyBalance.toFixed(2)}</span>
            </div>

            <div className="border-t-2 border-slate-500 mt-2 pt-3 text-center">
              {Math.abs(s.finalAmount) < 0.01 ? (
                <p className="text-green-600 font-black text-base">
                  ✅ ACCOUNT FULLY SETTLED — ₹0.00
                </p>
              ) : s.finalAmount > 0 ? (
                <div>
                  <p className="text-red-600 font-black text-base">🔴 FARMER HAS TO PAY ADMIN</p>
                  <p className="text-red-700 font-black text-2xl mt-1">
                    ₹{s.finalAmount.toFixed(2)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-green-600 font-black text-base">🟢 ADMIN HAS TO PAY FARMER</p>
                  <p className="text-green-700 font-black text-2xl mt-1">
                    ₹{Math.abs(s.finalAmount).toFixed(2)}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Action Buttons ─────────────────────────────────────────── */}
          <div className="flex flex-col md:flex-row gap-4">
            <button
              onClick={handleExportPDF}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-6 py-4 rounded-xl font-bold text-base transition-all shadow"
            >
              <Download className="w-5 h-5" /> Download PDF
            </button>

            {!data.isAlreadySettled && decisionState === "NONE" && (
              <button
                onClick={handleSettleAccount}
                disabled={settling}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-xl font-bold text-base transition-all shadow disabled:opacity-60"
              >
                {settling ? "Recording..." : <><ShieldCheck className="w-5 h-5" /> Settle Account</>}
              </button>
            )}
          </div>

          {/* ── Payment Decision Panel ─────────────────────────────────── */}
          {decisionState === "CHOOSING" && (
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="bg-indigo-100 p-2 rounded-full">
                  <ArrowRightLeft className="w-5 h-5 text-indigo-700" />
                </div>
                <div>
                  <h3 className="font-bold text-indigo-900 text-lg">
                    Settlement Recorded — Choose Payment Action
                  </h3>
                  <p className="text-indigo-700 text-sm">
                    {s.finalAmount > 0
                      ? `Farmer owes you ₹${s.finalAmount.toFixed(2)}. What do you want to do?`
                      : s.finalAmount < 0
                      ? `You owe farmer ₹${Math.abs(s.finalAmount).toFixed(2)}. What do you want to do?`
                      : "Account is balanced. No payment needed."}
                  </p>
                </div>
              </div>

              {Math.abs(s.finalAmount) < 0.01 ? (
                <button
                  onClick={() => handleDecision("PAID")}
                  disabled={settling}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-60"
                >
                  <CheckCircle2 className="w-5 h-5" /> Confirm — Account Fully Settled
                </button>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleDecision("PAID")}
                    disabled={settling}
                    className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-4 rounded-xl font-bold transition-all disabled:opacity-60"
                  >
                    <CreditCard className="w-5 h-5" />
                    {s.finalAmount > 0 ? "Paid by Farmer" : "Paid to Farmer"}
                  </button>
                  <button
                    onClick={() => handleDecision("CARRY_FORWARD")}
                    disabled={settling}
                    className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-4 rounded-xl font-bold transition-all disabled:opacity-60"
                  >
                    <ArrowRightLeft className="w-5 h-5" /> Carry Forward to Next Year
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Decision Confirmed ─────────────────────────────────────── */}
          {decisionState === "DECIDED" && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4">
              <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-bold text-green-800">Settlement Complete</p>
                <p className="text-green-700 text-sm">{decisionResult}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
