"use client";

import { useState, useEffect } from "react";
import {
  PackageSearch,
  Download,
  Calendar,
  Search,
  Plus,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Boxes,
  FileSpreadsheet,
  AlertCircle,
  RefreshCw,
  CheckCircle2,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { getMayAprilBusinessYear, getMayAprilBusinessYearOptions } from "@/lib/academicYear";
import { AlertModal } from "@/components/ui/AlertModal";

interface StockProduct {
  id?: string;
  category: string;
  name: string;
  size: string | null;
  price: number;
  openingStock: number;
  receivedStock: number;
  soldStock: number;
  closingStock: number;
  totalValue: number;
}

interface CategorySummary {
  totalItems: number;
  totalOpening: number;
  totalReceived: number;
  totalSold: number;
  totalClosing: number;
  totalValuation: number;
}

export default function StockHistoryPage() {
  const [selectedBY, setSelectedBY] = useState(() => getMayAprilBusinessYear());
  const [activeTab, setActiveTab] = useState<"FERTILIZER" | "PESTICIDE" | "ALL">("FERTILIZER");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportData, setReportData] = useState<any>(null);

  // Inward Stock Modal State
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [inwardCategory, setInwardCategory] = useState("FERTILIZER");
  const [inwardProductId, setInwardProductId] = useState("");
  const [inwardName, setInwardName] = useState("");
  const [inwardSize, setInwardSize] = useState("");
  const [inwardQty, setInwardQty] = useState("");
  const [inwardPrice, setInwardPrice] = useState("");
  const [inwardDate, setInwardDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [inwardNote, setInwardNote] = useState("");
  const [submittingInward, setSubmittingInward] = useState(false);

  // Alert Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"success" | "error">("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const fetchReport = async (businessYear: string) => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/stock/report?businessYear=${businessYear}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to load annual stock report");
      }
      const data = await res.json();
      setReportData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(selectedBY);
  }, [selectedBY]);

  const handleBYChange = (newBY: string) => {
    setSelectedBY(newBY);
  };

  const handleInwardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingInward(true);

    try {
      const payload: any = {
        category: inwardCategory,
        productName: inwardName.trim(),
        size: inwardSize.trim() || null,
        quantity: parseInt(inwardQty, 10),
        price: inwardPrice ? parseFloat(inwardPrice) : 0,
        date: inwardDate ? new Date(inwardDate).toISOString() : new Date().toISOString(),
        note: inwardNote || "Stock Received Inward Batch",
        movementType: "RECEIVED",
      };

      if (inwardProductId) {
        payload.productId = inwardProductId;
      }

      const res = await fetch("/api/stock/movement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to record stock movement");
      }

      setModalType("success");
      setModalTitle("Stock Received Successfully");
      setModalMessage(`Recorded ${inwardQty} units of ${inwardName} into inventory.`);
      setModalOpen(true);
      setShowInwardModal(false);

      // Reset form
      setInwardProductId("");
      setInwardName("");
      setInwardSize("");
      setInwardQty("");
      setInwardPrice("");
      setInwardNote("");

      // Refresh report
      fetchReport(selectedBY);
    } catch (err: any) {
      setModalType("error");
      setModalTitle("Entry Failed");
      setModalMessage(err.message);
      setModalOpen(true);
    } finally {
      setSubmittingInward(false);
    }
  };

  // Get active items according to tab
  const getFilteredItems = (): StockProduct[] => {
    if (!reportData) return [];
    let items: StockProduct[] = [];
    if (activeTab === "FERTILIZER") items = reportData.fertilizers || [];
    else if (activeTab === "PESTICIDE") items = reportData.pesticides || [];
    else items = [...(reportData.fertilizers || []), ...(reportData.pesticides || [])];

    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.size && i.size.toLowerCase().includes(q))
    );
  };

  const currentSummary: CategorySummary = reportData
    ? activeTab === "FERTILIZER"
      ? reportData.fertilizersSummary
      : activeTab === "PESTICIDE"
      ? reportData.pesticidesSummary
      : reportData.grandSummary
    : {
        totalItems: 0,
        totalOpening: 0,
        totalReceived: 0,
        totalSold: 0,
        totalClosing: 0,
        totalValuation: 0,
      };

  const handleExportPDF = () => {
    if (!reportData) return;

    const doc = new jsPDF();
    const shop = reportData.shopInfo || {};
    const items = getFilteredItems();
    const categoryTitle =
      activeTab === "FERTILIZER"
        ? "FERTILIZERS INVENTORY"
        : activeTab === "PESTICIDE"
        ? "PESTICIDES INVENTORY"
        : "COMBINED STOCK INVENTORY (FERTILIZERS & PESTICIDES)";

    let currentY = 18;

    // Header - Shop Details
    if (shop.shopName) {
      doc.setFontSize(20);
      doc.setTextColor(21, 128, 61);
      doc.setFont("helvetica", "bold");
      doc.text(shop.shopName.toUpperCase(), 105, currentY, { align: "center" });
      currentY += 6;
    }

    doc.setFontSize(9);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    const address = [shop.village, shop.mandal, shop.district, shop.state]
      .filter(Boolean)
      .join(", ");
    if (address) {
      doc.text(address, 105, currentY, { align: "center" });
      currentY += 5;
    }

    if (shop.phone || shop.gstNo) {
      const details = [
        shop.phone ? `Phone: ${shop.phone}` : null,
        shop.gstNo ? `GST: ${shop.gstNo}` : null,
      ]
        .filter(Boolean)
        .join(" | ");
      doc.text(details, 105, currentY, { align: "center" });
      currentY += 6;
    }

    doc.setFontSize(14);
    doc.setTextColor(44, 62, 80);
    doc.setFont("helvetica", "bold");
    doc.text("ANNUAL STOCK INVENTORY REPORT", 105, currentY + 2, { align: "center" });
    currentY += 8;

    doc.setFontSize(10);
    doc.setTextColor(70);
    doc.setFont("helvetica", "normal");
    const [startYrStr] = selectedBY.split("-");
    const startYr = parseInt(startYrStr, 10);
    doc.text(
      `May–April Business Year: ${selectedBY} (01-May-${startYr} to 30-Apr-${startYr + 1})`,
      105,
      currentY,
      { align: "center" }
    );
    currentY += 5;

    doc.setFont("helvetica", "bold");
    doc.setTextColor(21, 128, 61);
    doc.text(`Scope: ${categoryTitle}`, 105, currentY, { align: "center" });
    currentY += 4;

    doc.setDrawColor(21, 128, 61);
    doc.setLineWidth(0.5);
    doc.line(14, currentY, 196, currentY);
    currentY += 8;

    // Summary Box
    doc.setDrawColor(220);
    doc.setFillColor(248, 250, 252);
    doc.rect(14, currentY, 182, 22, "FD");

    doc.setFontSize(9);
    doc.setTextColor(60);
    doc.setFont("helvetica", "bold");
    doc.text(`Total Products: ${items.length}`, 18, currentY + 7);
    doc.text(`Opening Stock: ${currentSummary.totalOpening}`, 70, currentY + 7);
    doc.text(`Stock Received: ${currentSummary.totalReceived}`, 130, currentY + 7);

    doc.text(`Stock Sold: ${currentSummary.totalSold}`, 18, currentY + 16);
    doc.setTextColor(21, 128, 61);
    doc.text(`Closing Stock: ${currentSummary.totalClosing}`, 70, currentY + 16);
    doc.setTextColor(0);
    doc.text(`Total Valuation: Rs. ${currentSummary.totalValuation.toFixed(2)}`, 130, currentY + 16);

    currentY += 28;

    // Table
    const rows = items.map((item, idx) => [
      (idx + 1).toString(),
      item.size ? `${item.name} (${item.size})` : item.name,
      item.category === "FERTILIZER" ? "Fertilizer" : "Pesticide",
      item.openingStock.toString(),
      item.receivedStock.toString(),
      item.soldStock.toString(),
      item.closingStock.toString(),
      `Rs ${item.price.toFixed(2)}`,
      `Rs ${item.totalValue.toFixed(2)}`,
    ]);

    // Totals row
    rows.push([
      "",
      "TOTAL",
      "",
      currentSummary.totalOpening.toString(),
      currentSummary.totalReceived.toString(),
      currentSummary.totalSold.toString(),
      currentSummary.totalClosing.toString(),
      "",
      `Rs ${currentSummary.totalValuation.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: currentY,
      head: [
        [
          "#",
          "Product Name",
          "Category",
          "Opening",
          "Received",
          "Sold",
          "Closing",
          "Unit Price",
          "Total Value",
        ],
      ],
      body: rows,
      theme: "striped",
      headStyles: { fillColor: [21, 128, 61] },
      footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
      margin: { left: 14, right: 14 },
      didParseCell: (dataCell) => {
        if (dataCell.row.index === rows.length - 1) {
          dataCell.cell.styles.fontStyle = "bold";
          dataCell.cell.styles.fillColor = [230, 240, 230];
        }
      },
    });

    // Footer signature
    const finalY = (doc as any).lastAutoTable.finalY + 18;
    if (finalY < 270) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100);
      doc.text(`Report Generated On: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, finalY);
      doc.text("Authorized Signatory", 150, finalY);
    }

    const pdfBlobUrl = doc.output("bloburl");
    window.open(pdfBlobUrl, "_blank");
  };

  const filteredItems = getFilteredItems();
  const yearOptions = reportData?.availableYears || getMayAprilBusinessYearOptions();

  return (
    <div className="max-w-7xl mx-auto h-full flex flex-col pt-8 pb-12 px-4">
      <AlertModal
        isOpen={modalOpen}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setModalOpen(false)}
      />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-3 rounded-full">
            <PackageSearch className="w-7 h-7 text-emerald-700" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-green-950">Annual Stock History</h1>
            <p className="text-slate-500">
              May–April annual stock report with A–Z sorting, accurate Opening/Received/Sold/Closing calculations, and automatic carry-forward.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowInwardModal(true)}
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-4 py-2.5 rounded-lg font-medium transition-all shadow-sm text-sm"
          >
            <Plus className="w-4 h-4" /> Record Inward Stock
          </button>
          <button
            onClick={handleExportPDF}
            disabled={loading || !reportData}
            className="flex items-center gap-2 bg-slate-800 hover:bg-green-950 text-white px-4 py-2.5 rounded-lg font-medium transition-all shadow-sm text-sm disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> Export Annual PDF
          </button>
        </div>
      </div>

      {/* Control Bar: Business Year, Tabs, Search */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Business Year Selector */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Calendar className="w-5 h-5 text-emerald-700" />
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">
            May–April Year:
          </span>
          <select
            value={selectedBY}
            onChange={(e) => handleBYChange(e.target.value)}
            className="px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg text-sm font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {yearOptions.map((by: string) => {
              const startY = parseInt(by.split("-")[0], 10);
              return (
                <option key={by} value={by}>
                  {by} (01 May {startY} – 30 Apr {startY + 1})
                </option>
              );
            })}
          </select>
        </div>

        {/* Independent Category Tabs */}
        <div className="flex items-center bg-slate-100 p-1 rounded-lg w-full md:w-auto">
          <button
            onClick={() => setActiveTab("FERTILIZER")}
            className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
              activeTab === "FERTILIZER"
                ? "bg-white text-emerald-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Fertilizers ({reportData?.fertilizers?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("PESTICIDE")}
            className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
              activeTab === "PESTICIDE"
                ? "bg-white text-teal-800 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Pesticides ({reportData?.pesticides?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab("ALL")}
            className={`flex-1 md:flex-none px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
              activeTab === "ALL"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            All ({(reportData?.fertilizers?.length || 0) + (reportData?.pesticides?.length || 0)})
          </button>
        </div>

        {/* Search Filter */}
        <div className="relative w-full md:w-64">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search product..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>
      </div>

      {/* Automatic Carry-Forward Notice */}
      <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-4 mb-6 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-emerald-900 leading-relaxed">
          <span className="font-bold">Automatic Inventory Carry-Forward:</span> Unsold closing stock from the previous May–April business year automatically becomes the opening stock of this business year. All historical annual reports remain permanently preserved and accessible anytime.
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 font-medium">Opening Stock</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">{currentSummary.totalOpening}</p>
          <span className="text-[10px] text-slate-400">Carried from prev year</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-blue-500" /> Received Inward
          </span>
          <p className="text-2xl font-bold text-blue-600 mt-1">+{currentSummary.totalReceived}</p>
          <span className="text-[10px] text-slate-400">Restocked May–Apr</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 font-medium flex items-center gap-1">
            <TrendingDown className="w-3.5 h-3.5 text-amber-600" /> Sold Stock
          </span>
          <p className="text-2xl font-bold text-amber-600 mt-1">-{currentSummary.totalSold}</p>
          <span className="text-[10px] text-slate-400">Bills & purchases</span>
        </div>
        <div className="bg-emerald-950 p-4 rounded-xl border border-emerald-900 shadow-sm text-white">
          <span className="text-xs text-emerald-300 font-medium">Closing Stock</span>
          <p className="text-2xl font-bold text-white mt-1">{currentSummary.totalClosing}</p>
          <span className="text-[10px] text-emerald-300">Unsold inventory</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm col-span-2 md:col-span-1">
          <span className="text-xs text-slate-400 font-medium">Inventory Value</span>
          <p className="text-2xl font-bold text-slate-800 mt-1">
            ₹{currentSummary.totalValuation.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-slate-400">At current prices</span>
        </div>
      </div>

      {/* Main Stock Table (A–Z Alphabetical Sorting) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
            <Boxes className="w-4 h-4 text-slate-600" />
            {activeTab === "FERTILIZER"
              ? "Fertilizers Inventory (A–Z)"
              : activeTab === "PESTICIDE"
              ? "Pesticides Inventory (A–Z)"
              : "All Products (A–Z)"}
          </h2>
          <span className="text-xs text-slate-500 font-semibold bg-slate-200 px-2.5 py-0.5 rounded-full">
            {filteredItems.length} products listed
          </span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 flex flex-col items-center gap-3">
            <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
            <span>Calculating annual stock figures & carry-forwards...</span>
          </div>
        ) : error ? (
          <div className="p-8 text-center text-red-600">{error}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 border-b border-slate-200 text-xs">
                <tr>
                  <th className="px-4 py-3 font-semibold">#</th>
                  <th className="px-4 py-3 font-semibold">Product Name (A–Z)</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Size</th>
                  <th className="px-4 py-3 font-semibold text-right">Opening Stock</th>
                  <th className="px-4 py-3 font-semibold text-right">Received</th>
                  <th className="px-4 py-3 font-semibold text-right">Sold</th>
                  <th className="px-4 py-3 font-semibold text-right">Closing Stock</th>
                  <th className="px-4 py-3 font-semibold text-right">Price</th>
                  <th className="px-4 py-3 font-semibold text-right">Closing Value</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-slate-400">
                      No products found for this business year and filter.
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item, idx) => (
                    <tr key={`${item.category}-${item.name}-${idx}`} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-slate-400 font-mono text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                            item.category === "FERTILIZER"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-teal-100 text-teal-800"
                          }`}
                        >
                          {item.category === "FERTILIZER" ? "Fertilizer" : "Pesticide"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{item.size || "-"}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-600">
                        {item.openingStock}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600">
                        +{item.receivedStock}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-600">
                        -{item.soldStock}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            item.closingStock === 0
                              ? "bg-red-100 text-red-700"
                              : item.closingStock < 10
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {item.closingStock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-600">₹{item.price.toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        ₹{item.totalValue.toFixed(2)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {filteredItems.length > 0 && (
                <tfoot className="bg-slate-50 border-t-2 border-slate-300 font-bold text-slate-800 text-sm">
                  <tr>
                    <td colSpan={4} className="px-4 py-3 text-slate-700 uppercase">
                      Total Summary
                    </td>
                    <td className="px-4 py-3 text-right">{currentSummary.totalOpening}</td>
                    <td className="px-4 py-3 text-right text-blue-600">+{currentSummary.totalReceived}</td>
                    <td className="px-4 py-3 text-right text-amber-600">-{currentSummary.totalSold}</td>
                    <td className="px-4 py-3 text-right text-emerald-800">{currentSummary.totalClosing}</td>
                    <td className="px-4 py-3 text-right">-</td>
                    <td className="px-4 py-3 text-right text-green-950 font-black">
                      ₹{currentSummary.totalValuation.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>

      {/* Record Inward Stock Modal */}
      {showInwardModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-xl font-bold text-green-950 mb-1 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-700" /> Record Inward / Received Stock
            </h3>
            <p className="text-slate-500 text-xs mb-5">
              Log new stock shipments received from suppliers. This updates live inventory and logs an entry in this May–April business year.
            </p>

            <form onSubmit={handleInwardSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Category *</label>
                  <select
                    value={inwardCategory}
                    onChange={(e) => {
                      setInwardCategory(e.target.value);
                      setInwardProductId("");
                    }}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="FERTILIZER">Fertilizer</option>
                    <option value="PESTICIDE">Pesticide</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Receipt Date *</label>
                  <input
                    type="date"
                    value={inwardDate}
                    onChange={(e) => setInwardDate(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Urea or Coragen"
                  value={inwardName}
                  onChange={(e) => setInwardName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Size / Pack</label>
                  <input
                    type="text"
                    placeholder="e.g. 50kg, 1L"
                    value={inwardSize}
                    onChange={(e) => setInwardSize(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="0"
                    value={inwardQty}
                    onChange={(e) => setInwardQty(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={inwardPrice}
                    onChange={(e) => setInwardPrice(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Note / Supplier / Invoice</label>
                <input
                  type="text"
                  placeholder="e.g. IFFCO Batch #1029"
                  value={inwardNote}
                  onChange={(e) => setInwardNote(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowInwardModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingInward}
                  className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-semibold disabled:opacity-50"
                >
                  {submittingInward ? "Saving..." : "Add to Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
