"use client";

import { useState, useEffect } from "react";
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
  LayoutDashboard,
  UserCheck,
  UserX,
  Users,
  Lock,
  RefreshCw,
  Clock,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { AlertModal } from "@/components/ui/AlertModal";

type TabMode = "SETTLEMENT" | "OVERVIEW";
type DecisionState = "NONE" | "CHOOSING" | "DECIDED";

export default function AnnualSettlementPage() {
  const [activeTab, setActiveTab] = useState<TabMode>("SETTLEMENT");

  // Search & Calculator state
  const [searchId, setSearchId] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState<string>("active");
  const [settlementDate, setSettlementDate] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState<any>(null);

  // Settlement decision state
  const [settling, setSettling] = useState(false);
  const [settlementId, setSettlementId] = useState<string | null>(null);
  const [decisionState, setDecisionState] = useState<DecisionState>("NONE");
  const [decisionResult, setDecisionResult] = useState<string>("");

  // Overview Dashboard state
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewData, setOverviewData] = useState<any>(null);
  const [overviewFilter, setOverviewFilter] = useState<
    "ALL" | "UNSETTLED" | "SETTLED"
  >("ALL");
  const [overviewSearch, setOverviewSearch] = useState("");

  // Section collapse state
  const [expandedSections, setExpandedSections] = useState({
    pesticides: true,
    fertilizers: true,
    unsettledCrops: true,
    settledCrops: false,
    moneyTaken: true,
    loanRepayments: true,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"success" | "error">("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const toggleSection = (key: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ─── Fetch Overview ──────────────────────────────────────────────────────
  const fetchOverview = async () => {
    setOverviewLoading(true);
    try {
      const res = await fetch("/api/annual-settlement/overview");
      if (res.ok) {
        const result = await res.json();
        setOverviewData(result);
      }
    } catch (err) {
      console.error("Error fetching overview:", err);
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "OVERVIEW") {
      fetchOverview();
    }
  }, [activeTab]);

  // ─── Fetch Farmer Settlement ─────────────────────────────────────────────
  const fetchSettlement = async (
    farmerId: string,
    cycleId: string = "active",
    date: string = settlementDate
  ) => {
    if (!farmerId) return;
    setLoading(true);
    setError("");
    setData(null);
    setSettlementId(null);
    setDecisionState("NONE");
    setDecisionResult("");

    try {
      const res = await fetch(
        `/api/annual-settlement/${farmerId.trim().toUpperCase()}?cycleId=${cycleId}&settlementDate=${date}`
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to calculate settlement");
      }
      const result = await res.json();
      setData(result);
      setSelectedCycleId(result.cycle?.id || "active");

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
    fetchSettlement(searchId, "active", settlementDate);
  };

  const handleCycleChange = (newCycleId: string) => {
    setSelectedCycleId(newCycleId);
    if (searchId) {
      fetchSettlement(searchId, newCycleId, settlementDate);
    }
  };

  const handleDateChange = (newDate: string) => {
    setSettlementDate(newDate);
    if (searchId) {
      fetchSettlement(searchId, selectedCycleId, newDate);
    }
  };

  // Jump from overview row to farmer settlement
  const handleSelectFarmerFromOverview = (farmerNo: string) => {
    setSearchId(farmerNo);
    setActiveTab("SETTLEMENT");
    fetchSettlement(farmerNo, "active", settlementDate);
  };

  // ─── Step 1: Record Settlement ───────────────────────────────────────────
  const handleSettleAccount = async () => {
    if (!data) return;
    setSettling(true);
    try {
      const res = await fetch(
        `/api/annual-settlement/${searchId.trim().toUpperCase()}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settlementDate,
            status: "MANUALLY_SETTLED",
            summary: data.summary,
            cycleNumber: data.cycle?.cycleNumber,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record settlement");
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

  // ─── Step 2: Paid / Carry Forward Decision ─────────────────────────────
  const handleDecision = async (decision: "PAID" | "CARRY_FORWARD") => {
    if (!settlementId || !data) return;
    setSettling(true);
    try {
      const res = await fetch(
        `/api/annual-settlement/${searchId.trim().toUpperCase()}/decide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            settlementId,
            decision,
            finalAmount: data.summary.finalAmount,
            settlementDate,
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
          ? "✅ Payment Recorded (Cycle Closed)"
          : "🔄 Carried Forward to Next Cycle"
      );
      setModalMessage(result.message);
      setModalOpen(true);

      // Refresh farmer data
      fetchSettlement(searchId, "active", settlementDate);
    } catch (err: any) {
      setModalType("error");
      setModalTitle("Decision Failed");
      setModalMessage(err.message);
      setModalOpen(true);
    } finally {
      setSettling(false);
    }
  };

  // ─── PDF Export ──────────────────────────────────────────────────────────
  const generatePDF = () => {
    if (!data) return null;
    const { shopInfo, farmer, summary, cycle, status } = data;

    const doc = new jsPDF();
    let y = 15;

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
    doc.text("ANNUAL FINAL SETTLEMENT STATEMENT", 105, y, { align: "center" });
    y += 5;

    doc.setDrawColor(21, 128, 61);
    doc.setLineWidth(0.6);
    doc.line(14, y, 196, y);
    y += 8;

    doc.setFontSize(10);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(`Farmer: ${farmer.name}`, 14, y);
    doc.text(`Accounting Cycle: ${cycle?.label || "Active Cycle"}`, 120, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.text(`Farmer ID: ${farmer.farmerNo}   Phone: ${farmer.phone}`, 14, y);
    doc.text(
      `Settlement Date: ${format(new Date(settlementDate), "dd/MM/yyyy")}`,
      120,
      y
    );
    y += 6;
    doc.text(
      `Cycle Period: ${format(new Date(cycle.startDate), "dd/MM/yyyy")} → ${format(
        new Date(settlementDate),
        "dd/MM/yyyy"
      )}`,
      14,
      y
    );
    doc.text(`Status: ${status ? status.replace(/_/g, " ") : "ACTIVE"}`, 120, y);
    y += 8;

    doc.setDrawColor(200);
    doc.setLineWidth(0.3);
    doc.line(14, y, 196, y);
    y += 8;

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
      if (y > 230) {
        doc.addPage();
        y = 15;
      }

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
      doc.text(
        `${totalLabel}: Rs. ${(totalValue || 0).toFixed(2)}`,
        182,
        y,
        { align: "right" }
      );
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
      "Pesticides Subtotal",
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
      "Fertilizers Subtotal",
      summary.fertilizersTotal
    );

    // 3. Jama (జమ) by Farmer — A. Unsettled Crops
    renderSection(
      "3. Jama (జమ) by Farmer — A. Unsettled Crop Value (0% Interest)",
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
      "Unsettled Crops Subtotal",
      summary.unsettledCropsTotal
    );

    // 3. Jama (జమ) by Farmer — B. Cash Paid by Farmer
    renderSection(
      "3. Jama (జమ) by Farmer — B. Cash Paid / Deposited",
      data.loanRepayments,
      ["Receipt No", "Date", "Note", "Principal (Rs)", "Interest (Rs)", "Total (Rs)"],
      (i) => [
        String(i.receiptNo || "-"),
        fmtDate(i.date),
        i.note || "Jama (Cash Paid)",
        i.amount.toFixed(2),
        i.interest.toFixed(2),
        i.finalAmount.toFixed(2),
      ],
      [39, 100, 174],
      "Jama Cash Subtotal",
      summary.cashGivenTotal
    );

    // 4. Settled Crops (Record Only)
    if (data.settledCropsForRecord?.length > 0) {
      if (y > 230) {
        doc.addPage();
        y = 15;
      }
      doc.setFontSize(11);
      doc.setTextColor(120, 120, 120);
      doc.setFont("helvetica", "bold");
      doc.text(
        "4. Settled Crops — Reference Only (NOT Included in Calculation)",
        14,
        y
      );
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
      doc.setFontSize(8);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(150);
      doc.text("* Settled crops contribute Rs. 0.00 to final settlement.", 14, y);
      y += 10;
    }

    // 5. Baki (బాకీ) — Loans / Amount Taken
    renderSection(
      "5. Baki (బాకీ) — Amount Taken / Shop Loans",
      data.moneyTaken,
      ["Receipt No", "Date", "Note", "Principal (Rs)", "Interest (Rs)", "Total (Rs)"],
      (i) => [
        String(i.receiptNo || "-"),
        fmtDate(i.date),
        i.note || "Baki (Cash Taken)",
        i.amount.toFixed(2),
        i.interest.toFixed(2),
        i.finalAmount.toFixed(2),
      ],
      [211, 84, 0],
      "Baki (బాకీ) Total",
      summary.cashTakenTotal
    );

    // ── Bottom Calculation Box ──
    if (y > 200) {
      doc.addPage();
      y = 15;
    }

    doc.setDrawColor(180);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, y, 182, 85, "FD");

    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.setFont("helvetica", "bold");

    const boxX = 20;
    const valX = 186;

    doc.text("Pesticides", boxX, y + 10);
    doc.text(`Rs. ${(summary.pesticidesTotal || 0).toFixed(2)}`, valX, y + 10, {
      align: "right",
    });

    doc.text("Fertilizers", boxX, y + 17);
    doc.text(`Rs. ${(summary.fertilizersTotal || 0).toFixed(2)}`, valX, y + 17, {
      align: "right",
    });

    doc.text("Unsettled Crops (Repayments)", boxX, y + 24);
    doc.text(`- Rs. ${(summary.unsettledCropsTotal || 0).toFixed(2)}`, valX, y + 24, {
      align: "right",
    });

    doc.setDrawColor(180);
    doc.setLineWidth(0.4);
    doc.line(boxX, y + 28, valX, y + 28);

    doc.setFontSize(10.5);
    doc.text("Total Liabilities", boxX, y + 35);
    doc.text(`Rs. ${(summary.totalLiabilities || 0).toFixed(2)}`, valX, y + 35, {
      align: "right",
    });

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("Baki (బాకీ) — Taken", boxX, y + 43);
    doc.text(`Rs. ${(summary.cashTakenTotal || 0).toFixed(2)}`, valX, y + 43, {
      align: "right",
    });
    doc.text("Jama (జమ) — Paid (Repayments)", boxX, y + 50);
    doc.text(`- Rs. ${(summary.cashGivenTotal || 0).toFixed(2)}`, valX, y + 50, {
      align: "right",
    });

    doc.setFont("helvetica", "bold");
    doc.line(boxX, y + 54, valX, y + 54);
    doc.text("Total Jama (జమ) Deductions", boxX, y + 61);
    doc.text(`Rs. ${(summary.totalLoanRepayments || 0).toFixed(2)}`, valX, y + 61, {
      align: "right",
    });

    doc.line(boxX, y + 65, valX, y + 65);

    const fa = summary.finalAmount || 0;
    doc.setFontSize(12);
    if (Math.abs(fa) < 0.01) {
      doc.setTextColor(21, 128, 61);
      doc.text("ACCOUNT FULLY SETTLED — Rs. 0.00", 105, y + 75, {
        align: "center",
      });
    } else if (fa > 0) {
      doc.setTextColor(192, 57, 43);
      doc.text(`Baki (బాకీ) — FARMER HAS TO PAY ADMIN`, 105, y + 72, { align: "center" });
      doc.setFontSize(14);
      doc.text(`Rs. ${fa.toFixed(2)}`, 105, y + 80, { align: "center" });
    } else {
      doc.setTextColor(21, 128, 61);
      doc.text(`Jama (జమ) — ADMIN HAS TO PAY FARMER`, 105, y + 72, { align: "center" });
      doc.setFontSize(14);
      doc.text(`Rs. ${Math.abs(fa).toFixed(2)}`, 105, y + 80, { align: "center" });
    }

    return doc;
  };

  const handleExportPDF = () => {
    const doc = generatePDF();
    if (!doc) return;
    window.open(doc.output("bloburl"), "_blank");
  };

  const s = data?.summary;

  // Overview filtered farmers
  const filteredOverviewFarmers = overviewData?.farmers.filter((f: any) => {
    const matchesSearch =
      f.name.toLowerCase().includes(overviewSearch.toLowerCase()) ||
      f.farmerNo.toLowerCase().includes(overviewSearch.toLowerCase()) ||
      f.phone.includes(overviewSearch);

    const isUnsettled = f.activeCycle?.hasActiveTransactions;

    if (overviewFilter === "UNSETTLED") return matchesSearch && isUnsettled;
    if (overviewFilter === "SETTLED") return matchesSearch && !isUnsettled;
    return matchesSearch;
  });

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col pt-6 pb-16 px-4">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-indigo-100 p-3 rounded-xl text-indigo-700">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-green-950">
              Annual Final Settlement
            </h1>
            <p className="text-slate-500 text-xs">
              Dynamic Accounting Cycles — Settle flexibly on farmer's convenient date
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            if (activeTab === "OVERVIEW") fetchOverview();
            else if (searchId) fetchSettlement(searchId, selectedCycleId, settlementDate);
          }}
          className="flex items-center gap-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-3 py-2 rounded-xl transition-all"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tab Switcher */}
      <div className="flex border-b border-slate-200 mb-6 gap-2">
        <button
          onClick={() => setActiveTab("SETTLEMENT")}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-sm rounded-t-xl border-b-2 transition-all ${
            activeTab === "SETTLEMENT"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/50"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Search className="w-4 h-4" /> Farmer Settlement
        </button>
        <button
          onClick={() => setActiveTab("OVERVIEW")}
          className={`flex items-center gap-2 px-5 py-3 font-bold text-sm rounded-t-xl border-b-2 transition-all ${
            activeTab === "OVERVIEW"
              ? "border-indigo-600 text-indigo-600 bg-indigo-50/50"
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <LayoutDashboard className="w-4 h-4" /> Settlement Overview Dashboard
        </button>
      </div>

      <AlertModal
        isOpen={modalOpen}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setModalOpen(false)}
      />

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: FARMER SETTLEMENT                                          */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "SETTLEMENT" && (
        <div className="space-y-6">
          {/* Search & Calculation Bar */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <form
              onSubmit={handleSearch}
              className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end"
            >
              <div className="space-y-1.5 md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">
                  Farmer ID / Number
                </label>
                <input
                  type="text"
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                  placeholder="e.g. 1001"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none uppercase font-semibold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 flex items-center gap-1">
                  <Calendar className="w-4 h-4 text-indigo-600" /> Settlement Date
                </label>
                <input
                  type="date"
                  value={settlementDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-sm font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={loading || !searchId}
                className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 h-[42px] rounded-lg font-medium transition-all disabled:opacity-60 shadow"
              >
                {loading ? (
                  "Calculating..."
                ) : (
                  <>
                    <Search className="w-4 h-4" /> Calculate Account
                  </>
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm border border-red-200">
                <AlertCircle className="w-5 h-5 flex-shrink-0" /> {error}
              </div>
            )}
          </div>

          {/* Results Display */}
          {data && s && (
            <div className="space-y-5">
              {/* Dynamic Accounting Cycle Selector Banner */}
              <div className="bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-200 rounded-2xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs bg-indigo-600 text-white px-3 py-1 rounded-full font-bold">
                      {data.cycle?.shortLabel || "Active Cycle"}
                    </span>
                    <h2 className="text-lg font-bold text-slate-900">
                      {data.farmer.name} ({data.farmer.farmerNo})
                    </h2>
                  </div>
                  <p className="text-slate-600 text-xs flex items-center gap-1.5 pt-1">
                    <Clock className="w-3.5 h-3.5 text-indigo-600" />
                    <strong>Cycle Period:</strong>{" "}
                    {format(new Date(data.cycle.startDate), "dd MMM yyyy")} ➔{" "}
                    {format(new Date(settlementDate), "dd MMM yyyy")}
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    Cycle begins from first bill or day after previous settlement. Next cycle automatically begins tomorrow.
                  </p>
                </div>

                {/* Cycle Switcher (if farmer has multiple cycles) */}
                {data.allCycles?.length > 1 && (
                  <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-indigo-200 shadow-xs">
                    <span className="text-xs font-semibold text-slate-600">
                      View Cycle:
                    </span>
                    <select
                      value={selectedCycleId}
                      onChange={(e) => handleCycleChange(e.target.value)}
                      className="text-xs font-bold text-indigo-700 bg-transparent outline-none cursor-pointer"
                    >
                      {data.allCycles.map((c: any) => (
                        <option key={c.id} value={c.id}>
                          {c.label} {c.isClosed ? `(Settled: ₹${(c.totalAmount || 0).toFixed(0)})` : "— Active"}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Closed / Historical Banner */}
              {data.isAlreadySettled && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Lock className="w-6 h-6 text-amber-700 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-amber-900 text-sm">
                        ⚠️ This Accounting Cycle is SETTLED / CLOSED
                      </p>
                      <p className="text-amber-800 text-xs">
                        Settled on {format(new Date(data.cycle.endDate), "dd/MM/yyyy")}. Transactions in this cycle are preserved for history and excluded from new cycles.
                      </p>
                    </div>
                  </div>
                  <span className="text-xs bg-green-100 text-green-800 font-bold px-3 py-1 rounded-full uppercase">
                    {data.paymentStatus || "SETTLED"}
                  </span>
                </div>
              )}

              {/* Section 1: Pesticides */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <button
                  onClick={() => toggleSection("pesticides")}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-all text-left"
                >
                  <span className="font-bold text-slate-800 text-sm">
                    1. Pesticides ({data.pesticides.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      ₹{s.pesticidesTotal.toFixed(2)}
                    </span>
                    {expandedSections.pesticides ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>
                {expandedSections.pesticides && data.pesticides.length > 0 && (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Bill No</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">Principal</th>
                        <th className="px-3 py-2 text-right">Interest (₹2/mo)</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.pesticides.map((i: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium">{i.billNo || "-"}</td>
                          <td className="px-3 py-2">
                            {format(new Date(i.date), "dd/MM/yyyy")}
                          </td>
                          <td className="px-3 py-2">{i.product}</td>
                          <td className="px-3 py-2 text-right">₹{i.total.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-amber-600">
                            ₹{i.interest.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900">
                            ₹{i.finalAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Section 2: Fertilizers */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <button
                  onClick={() => toggleSection("fertilizers")}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-all text-left"
                >
                  <span className="font-bold text-slate-800 text-sm">
                    2. Fertilizers ({data.fertilizers.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      ₹{s.fertilizersTotal.toFixed(2)}
                    </span>
                    {expandedSections.fertilizers ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>
                {expandedSections.fertilizers && data.fertilizers.length > 0 && (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Bill No</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Product</th>
                        <th className="px-3 py-2 text-right">Principal</th>
                        <th className="px-3 py-2 text-right">Interest (₹2/mo)</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.fertilizers.map((i: any, idx: number) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-3 py-2 font-medium">{i.billNo || "-"}</td>
                          <td className="px-3 py-2">
                            {format(new Date(i.date), "dd/MM/yyyy")}
                          </td>
                          <td className="px-3 py-2">{i.product}</td>
                          <td className="px-3 py-2 text-right">₹{i.total.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right text-amber-600">
                            ₹{i.interest.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-slate-900">
                            ₹{i.finalAmount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Section 3: Jama (జమ) by Farmer */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden space-y-3 p-4 shadow-xs">
                <h3 className="font-bold text-slate-800 text-sm">
                  3. Jama (జమ) by Farmer (Amount Paid / Deposited & Deductions)
                </h3>

                {/* Sub-section A: Unsettled Crop Value */}
                <div className="border border-green-200 rounded-lg overflow-hidden">
                  <div className="p-3 bg-green-50 flex justify-between font-semibold text-green-900 text-xs">
                    <span>A. Unsettled Crop Value (Cotton & Mirchi — 0% Interest)</span>
                    <span>₹{s.unsettledCropsTotal.toFixed(2)}</span>
                  </div>
                  {data.unsettledCrops.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left">Log No</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Crop</th>
                          <th className="px-3 py-2 text-right">Weight (qtl)</th>
                          <th className="px-3 py-2 text-right">Price/qtl</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.unsettledCrops.map((i: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">{i.logNo || "-"}</td>
                            <td className="px-3 py-2">
                              {format(new Date(i.date), "dd/MM/yyyy")}
                            </td>
                            <td className="px-3 py-2 font-medium">{i.cropType}</td>
                            <td className="px-3 py-2 text-right">
                              {(i.totalWeight / 100).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right">
                              ₹{(i.price || 0).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-green-700">
                              ₹{i.amount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-slate-400 p-3">
                      No unsettled crop logs for this cycle.
                    </p>
                  )}
                </div>

                {/* Sub-section B: Cash Repayments */}
                <div className="border border-blue-200 rounded-lg overflow-hidden">
                  <div className="p-3 bg-blue-50 flex justify-between font-semibold text-blue-900 text-xs">
                    <span>B. Jama (జమ) — Cash Paid by Farmer</span>
                    <span>₹{s.cashGivenTotal.toFixed(2)}</span>
                  </div>
                  {data.loanRepayments.length > 0 ? (
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-3 py-2 text-left">Receipt No</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Note</th>
                          <th className="px-3 py-2 text-right">Principal</th>
                          <th className="px-3 py-2 text-right">Interest</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {data.loanRepayments.map((i: any, idx: number) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">{i.receiptNo || "-"}</td>
                            <td className="px-3 py-2">
                              {format(new Date(i.date), "dd/MM/yyyy")}
                            </td>
                            <td className="px-3 py-2">{i.note || "Repayment"}</td>
                            <td className="px-3 py-2 text-right">
                              ₹{i.amount.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right text-green-600">
                              ₹{i.interest.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-blue-700">
                              ₹{i.finalAmount.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <p className="text-xs text-slate-400 p-3">
                      No cash loan repayments for this cycle.
                    </p>
                  )}
                </div>
              </div>

              {/* Section 4: Settled Crops (Record Only) */}
              {data.settledCropsForRecord?.length > 0 && (
                <div className="bg-slate-50 border border-dashed border-slate-300 rounded-xl p-4 opacity-75">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-slate-600 text-xs">
                      4. Settled Crops — Reference Only (NOT Included in Calculation)
                    </span>
                    <span className="text-xs text-green-700 font-bold bg-green-100 px-2 py-0.5 rounded">
                      Contributes ₹0.00
                    </span>
                  </div>
                  <table className="w-full text-xs text-slate-500">
                    <thead>
                      <tr className="bg-slate-100">
                        <th className="px-3 py-2 text-left">Log No</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Crop</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.settledCropsForRecord.map((i: any, idx: number) => (
                        <tr key={idx}>
                          <td className="px-3 py-2">{i.logNo || "-"}</td>
                          <td className="px-3 py-2">
                            {format(new Date(i.date), "dd/MM/yyyy")}
                          </td>
                          <td className="px-3 py-2">{i.cropType}</td>
                          <td className="px-3 py-2 text-right line-through">
                            ₹{i.amount.toFixed(2)}
                          </td>
                          <td className="px-3 py-2 text-right font-bold text-green-600">
                            SETTLED ✓
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Section 5: Baki (బాకీ) */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
                <button
                  onClick={() => toggleSection("moneyTaken")}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-all text-left"
                >
                  <span className="font-bold text-slate-800 text-sm">
                    5. Baki (బాకీ) — Loans / Amount Taken ({data.moneyTaken.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 text-sm">
                      ₹{s.cashTakenTotal.toFixed(2)}
                    </span>
                    {expandedSections.moneyTaken ? (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    )}
                  </div>
                </button>
                {expandedSections.moneyTaken && data.moneyTaken.length > 0 && (
                  <table className="w-full text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        <th className="px-3 py-2 text-left">Receipt No</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Note / Purpose</th>
                        <th className="px-3 py-2 text-right">Principal</th>
                        <th className="px-3 py-2 text-right">Interest (₹2/mo)</th>
                        <th className="px-3 py-2 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.moneyTaken.map((i: any, idx: number) => {
                        const isCarryForward = i.note?.includes("Carry Forward");
                        return (
                          <tr
                            key={idx}
                            className={
                              isCarryForward
                                ? "bg-amber-50/70 font-medium"
                                : "hover:bg-slate-50"
                            }
                          >
                            <td className="px-3 py-2">{i.receiptNo || "-"}</td>
                            <td className="px-3 py-2">
                              {format(new Date(i.date), "dd/MM/yyyy")}
                            </td>
                            <td className="px-3 py-2">
                              {isCarryForward ? (
                                <span className="inline-flex items-center gap-1 text-amber-800 font-bold">
                                  <ArrowRightLeft className="w-3.5 h-3.5" />{" "}
                                  {i.note}
                                </span>
                              ) : (
                                i.note || "Baki (Advance)"
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              ₹{i.amount.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right text-amber-600">
                              ₹{i.interest.toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-bold text-slate-900">
                              ₹{i.finalAmount.toFixed(2)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Calculation Summary Box */}
              <div className="bg-slate-50 border border-slate-300 rounded-2xl p-6 font-mono text-sm space-y-1.5 shadow-inner">
                <div className="flex justify-between text-slate-700">
                  <span>Pesticides</span>
                  <span>₹{s.pesticidesTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Fertilizers</span>
                  <span>₹{s.fertilizersTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-700">
                  <span>Unsettled Crops (Repayment)</span>
                  <span>- ₹{s.unsettledCropsTotal.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-400 my-1 pt-1 flex justify-between font-black text-slate-900">
                  <span>Total Liabilities</span>
                  <span>₹{s.totalLiabilities.toFixed(2)}</span>
                </div>

                <div className="pt-2 flex justify-between text-slate-600">
                  <span>Baki (బాకీ) — Taken</span>
                  <span>₹{s.cashTakenTotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Jama (జమ) — Paid (Repayments)</span>
                  <span>- ₹{s.cashGivenTotal.toFixed(2)}</span>
                </div>
                <div className="border-t border-slate-400 my-1 pt-1 flex justify-between font-black text-slate-900">
                  <span>Total Jama (జమ) Deductions</span>
                  <span>₹{s.totalLoanRepayments.toFixed(2)}</span>
                </div>

                <div className="border-t-2 border-slate-500 mt-3 pt-3 text-center">
                  {Math.abs(s.finalAmount) < 0.01 ? (
                    <p className="text-green-600 font-black text-base">
                      ✅ ACCOUNT FULLY SETTLED — ₹0.00
                    </p>
                  ) : s.finalAmount > 0 ? (
                    <div>
                      <p className="text-red-600 font-black text-sm">
                        🔴 Baki (బాకీ) — FARMER HAS TO PAY ADMIN
                      </p>
                      <p className="text-red-700 font-black text-2xl mt-1">
                        ₹{s.finalAmount.toFixed(2)}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-green-600 font-black text-sm">
                        🟢 Jama (జమ) — ADMIN HAS TO PAY FARMER
                      </p>
                      <p className="text-green-700 font-black text-2xl mt-1">
                        ₹{Math.abs(s.finalAmount).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col md:flex-row gap-4">
                <button
                  onClick={handleExportPDF}
                  className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-800 text-white px-6 py-4 rounded-xl font-bold text-base transition-all shadow"
                >
                  <Download className="w-5 h-5" /> Download PDF Statement
                </button>

                {!data.isAlreadySettled && decisionState === "NONE" && (
                  <button
                    onClick={handleSettleAccount}
                    disabled={settling}
                    className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-4 rounded-xl font-bold text-base transition-all shadow disabled:opacity-60"
                  >
                    {settling ? (
                      "Recording..."
                    ) : (
                      <>
                        <ShieldCheck className="w-5 h-5" /> Record Annual Settlement
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Decision Choice Panel */}
              {decisionState === "CHOOSING" && (
                <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 space-y-4 shadow-sm animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="bg-indigo-100 p-2 rounded-full text-indigo-700">
                      <ArrowRightLeft className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-indigo-950 text-base">
                        Settlement Recorded — Choose Settlement Action
                      </h3>
                      <p className="text-indigo-800 text-xs">
                        {s.finalAmount > 0
                          ? `Farmer owes ₹${s.finalAmount.toFixed(
                              2
                            )}. How would you like to handle this balance?`
                          : s.finalAmount < 0
                          ? `You owe farmer ₹${Math.abs(s.finalAmount).toFixed(
                              2
                            )}. How would you like to handle this balance?`
                          : "Account is balanced with zero outstanding."}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <button
                      onClick={() => handleDecision("PAID")}
                      disabled={settling}
                      className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all shadow disabled:opacity-60"
                    >
                      <CreditCard className="w-4 h-4" />
                      {s.finalAmount > 0
                        ? "Receive Payment from Farmer (Full Settlement)"
                        : "Pay Farmer (Full Settlement)"}
                    </button>
                    <button
                      onClick={() => handleDecision("CARRY_FORWARD")}
                      disabled={settling}
                      className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-6 py-3.5 rounded-xl font-bold text-sm transition-all shadow disabled:opacity-60"
                    >
                      <ArrowRightLeft className="w-4 h-4" /> Carry Forward to Next Cycle (Opening Balance)
                    </button>
                  </div>
                </div>
              )}

              {/* Decision Confirmed */}
              {decisionState === "DECIDED" && (
                <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4">
                  <CheckCircle2 className="w-8 h-8 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-green-800 text-sm">
                      Settlement Complete
                    </p>
                    <p className="text-green-700 text-xs">{decisionResult}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: SETTLEMENT OVERVIEW DASHBOARD                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === "OVERVIEW" && (
        <div className="space-y-6">
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase">
                  Total Farmers
                </p>
                <p className="text-3xl font-black text-slate-800 mt-1">
                  {overviewData?.stats?.totalFarmers || 0}
                </p>
              </div>
              <div className="bg-slate-100 p-3 rounded-xl text-slate-600">
                <Users className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase">
                  Active Unsettled Farmers
                </p>
                <p className="text-3xl font-black text-amber-700 mt-1">
                  {overviewData?.stats?.activeUnsettledCount || 0}
                </p>
              </div>
              <div className="bg-amber-100 p-3 rounded-xl text-amber-700">
                <UserX className="w-6 h-6" />
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-green-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-green-600 uppercase">
                  Settlements Completed
                </p>
                <p className="text-3xl font-black text-green-700 mt-1">
                  {overviewData?.stats?.totalSettlementsCompleted || 0}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl text-green-700">
                <UserCheck className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* Filter & Search Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex gap-2 w-full md:w-auto">
              <button
                onClick={() => setOverviewFilter("ALL")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  overviewFilter === "ALL"
                    ? "bg-indigo-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                All ({overviewData?.stats?.totalFarmers || 0})
              </button>
              <button
                onClick={() => setOverviewFilter("UNSETTLED")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  overviewFilter === "UNSETTLED"
                    ? "bg-amber-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Active Unsettled ({overviewData?.stats?.activeUnsettledCount || 0})
              </button>
              <button
                onClick={() => setOverviewFilter("SETTLED")}
                className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${
                  overviewFilter === "SETTLED"
                    ? "bg-green-600 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Settled / Zero Debt
              </button>
            </div>

            <div className="w-full md:w-64">
              <input
                type="text"
                value={overviewSearch}
                onChange={(e) => setOverviewSearch(e.target.value)}
                placeholder="Search Farmer ID / Name..."
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Farmers Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {overviewLoading ? (
              <div className="p-8 text-center text-slate-500">
                Loading overview...
              </div>
            ) : filteredOverviewFarmers?.length > 0 ? (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left">Farmer ID</th>
                    <th className="px-4 py-3 text-left">Farmer Name</th>
                    <th className="px-4 py-3 text-left">Phone</th>
                    <th className="px-4 py-3 text-left">Active Cycle Started</th>
                    <th className="px-4 py-3 text-right">Estimated Active Balance</th>
                    <th className="px-4 py-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredOverviewFarmers.map((f: any) => {
                    const balance = f.activeCycle?.estimatedBalance || 0;
                    return (
                      <tr key={f.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-bold text-indigo-700">
                          {f.farmerNo}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-800">
                          {f.name}
                        </td>
                        <td className="px-4 py-3 text-slate-500">{f.phone}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {format(
                            new Date(f.activeCycle?.startDate),
                            "dd MMM yyyy"
                          )}{" "}
                          <span className="text-[10px] text-slate-400">
                            ({f.activeCycle?.daysActive || 0}d)
                          </span>
                        </td>
                        <td
                          className={`px-4 py-3 text-right font-bold ${
                            balance > 0
                              ? "text-red-600"
                              : balance < 0
                              ? "text-green-700"
                              : "text-slate-600"
                          }`}
                        >
                          {balance > 0
                            ? `₹${balance.toFixed(2)} (Owes)`
                            : balance < 0
                            ? `₹${Math.abs(balance).toFixed(2)} (Advance)`
                            : "₹0.00"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              handleSelectFarmerFromOverview(f.farmerNo)
                            }
                            className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                          >
                            Settle Account
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-400">
                No farmers found matching filters.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
