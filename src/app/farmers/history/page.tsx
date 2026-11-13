"use client";

import { useState, useEffect } from "react";
import {
  History,
  Search,
  Download,
  FileText,
  Sprout,
  ArrowDownCircle,
  ArrowUpCircle,
  ShieldCheck,
  Calendar,
  Lock,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export default function FarmerHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCycleId, setSelectedCycleId] = useState("ALL");

  const [allFarmers, setAllFarmers] = useState<any[]>([]);
  const [filteredFarmers, setFilteredFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [farmerData, setFarmerData] = useState<any>(null);
  const [selectedFarmerNo, setSelectedFarmerNo] = useState<string | null>(null);

  // Fetch all farmers on mount
  useEffect(() => {
    const fetchFarmers = async () => {
      try {
        const res = await fetch("/api/farmers");
        if (res.ok) {
          const data = await res.json();
          setAllFarmers(data);
          setFilteredFarmers(data);
        }
      } catch (err) {
        setError("Failed to load farmers list.");
      } finally {
        setLoading(false);
      }
    };
    fetchFarmers();
  }, []);

  // Filter farmers locally based on search query
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredFarmers(allFarmers);
    } else {
      const q = searchQuery.toLowerCase();
      setFilteredFarmers(
        allFarmers.filter(
          (f) =>
            f.name.toLowerCase().includes(q) ||
            f.farmerNo.toLowerCase().includes(q) ||
            f.phone.includes(q)
        )
      );
    }
  }, [searchQuery, allFarmers]);

  const fetchFarmerHistory = async (farmerNo: string, cycleId: string = selectedCycleId) => {
    setLoading(true);
    setError("");
    setFarmerData(null);
    setSelectedFarmerNo(farmerNo);

    try {
      const res = await fetch(
        `/api/farmers/${farmerNo.toUpperCase()}/history?cycleId=${cycleId}`
      );
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

  const handleCycleChange = (newCycleId: string) => {
    setSelectedCycleId(newCycleId);
    if (selectedFarmerNo) {
      fetchFarmerHistory(selectedFarmerNo, newCycleId);
    }
  };

  const getTimeline = () => {
    if (!farmerData) return [];
    const tl: any[] = [];

    farmerData.bills?.forEach((b: any) =>
      tl.push({ ...b, timelineType: "BILL", dateObj: new Date(b.date) })
    );
    farmerData.cashTransactions?.forEach((c: any) =>
      tl.push({ ...c, timelineType: "CASH", dateObj: new Date(c.date) })
    );
    farmerData.cropLogs?.forEach((c: any) =>
      tl.push({ ...c, timelineType: "CROP_LOG", dateObj: new Date(c.date) })
    );
    farmerData.annualSettlements?.forEach((s: any) =>
      tl.push({ ...s, timelineType: "ANNUAL_SETTLEMENT", dateObj: new Date(s.periodEnd) })
    );

    return tl.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  };

  const generatePDF = (dataToExport: any) => {
    if (!dataToExport) return;

    const doc = new jsPDF();
    let currentY = 22;

    doc.setFontSize(20);
    doc.setTextColor(21, 128, 61);
    doc.setFont("helvetica", "bold");
    doc.text("Farmer Audit History Statement", 14, currentY);
    currentY += 8;

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.setFont("helvetica", "normal");
    const activeCycleLabel =
      selectedCycleId === "ALL"
        ? "All Accounting Cycles Complete Audit"
        : (dataToExport.allCycles?.find((c: any) => c.id === selectedCycleId)?.label || selectedCycleId);
    doc.text(`Scope: ${activeCycleLabel}`, 14, currentY);
    currentY += 8;

    doc.setFontSize(11);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text(`Farmer ID: ${dataToExport.farmerNo}`, 14, currentY);
    doc.text(`Name: ${dataToExport.name}`, 14, currentY + 6);
    doc.text(`Phone: ${dataToExport.phone}`, 14, currentY + 12);
    currentY += 22;

    // SECTION 1: Billing (Purchases)
    if (dataToExport.bills && dataToExport.bills.length > 0) {
      doc.setFontSize(13);
      doc.setTextColor(41, 128, 185);
      doc.setFont("helvetica", "bold");
      doc.text("1. Purchase Bills (Fertilizers & Pesticides)", 14, currentY);
      currentY += 4;

      const billRows = dataToExport.bills.map((b: any) => [
        `#${b.billNo || "-"}`,
        format(new Date(b.date), "dd/MM/yyyy"),
        b.category,
        b.product,
        b.quantity.toString(),
        `Rs ${b.price.toFixed(2)}`,
        `Rs ${b.total.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Bill No", "Date", "Category", "Product", "Qty", "Price", "Total"]],
        body: billRows,
        theme: "striped",
        headStyles: { fillColor: [41, 128, 185] },
        margin: { left: 14, right: 14 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 14;
    }

    // SECTION 2: Cash Transactions
    if (dataToExport.cashTransactions && dataToExport.cashTransactions.length > 0) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(13);
      doc.setTextColor(211, 84, 0);
      doc.setFont("helvetica", "bold");
      doc.text("2. Cash Transactions (Loans & Repayments)", 14, currentY);
      currentY += 4;

      const cashRows = dataToExport.cashTransactions.map((c: any) => [
        `#${c.receiptNo || "-"}`,
        format(new Date(c.date), "dd/MM/yyyy"),
        c.type === "TAKEN" ? "Money Taken (Loan)" : "Money Given (Repaid)",
        c.note || "-",
        `Rs ${c.amount.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Receipt", "Date", "Type", "Note / Purpose", "Amount"]],
        body: cashRows,
        theme: "striped",
        headStyles: { fillColor: [211, 84, 0] },
        margin: { left: 14, right: 14 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 14;
    }

    // SECTION 3: Crops
    if (dataToExport.cropLogs && dataToExport.cropLogs.length > 0) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(13);
      doc.setTextColor(39, 174, 96);
      doc.setFont("helvetica", "bold");
      doc.text("3. Crop Logs (Cotton & Mirchi)", 14, currentY);
      currentY += 4;

      const cropRows = dataToExport.cropLogs.map((c: any) => {
        const bags = Array.isArray(c.bagWeights)
          ? c.bagWeights.length
          : JSON.parse(c.bagWeights || "[]").length;
        const total = (c.totalWeight / 100) * (c.price || 0);
        return [
          `#${c.logNo || "-"}`,
          format(new Date(c.date), "dd/MM/yyyy"),
          c.cropType,
          `${bags} bags`,
          `${(c.totalWeight / 100).toFixed(2)} qtl`,
          `Rs ${(c.price || 0).toFixed(2)}`,
          `Rs ${total.toFixed(2)}`,
          c.isSettled ? "Settled" : "Unsettled",
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [["Log No", "Date", "Crop", "Bags", "Total Wt", "Rate/Qtl", "Total Val", "Status"]],
        body: cropRows,
        theme: "striped",
        headStyles: { fillColor: [39, 174, 96] },
        margin: { left: 14, right: 14 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 14;
    }

    // SECTION 4: Annual Settlements
    if (dataToExport.annualSettlements && dataToExport.annualSettlements.length > 0) {
      if (currentY > 230) {
        doc.addPage();
        currentY = 20;
      }
      doc.setFontSize(13);
      doc.setTextColor(142, 68, 173);
      doc.setFont("helvetica", "bold");
      doc.text("4. Annual Settlement Records", 14, currentY);
      currentY += 4;

      const settlementRows = dataToExport.annualSettlements.map((s: any) => [
        s.academicYear || `Settlement`,
        format(new Date(s.periodEnd), "dd/MM/yyyy"),
        `Rs ${s.totalPurchases.toFixed(2)}`,
        `Rs ${s.interestAmount.toFixed(2)}`,
        `Rs ${s.totalAmount.toFixed(2)}`,
        s.paymentStatus,
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [["Cycle / Period", "Settled On", "Purchases", "Interest", "Final Total", "Decision"]],
        body: settlementRows,
        theme: "striped",
        headStyles: { fillColor: [142, 68, 173] },
        margin: { left: 14, right: 14 },
      });
    }

    const pdfBlobUrl = doc.output("bloburl");
    window.open(pdfBlobUrl, "_blank");
  };

  const timeline = getTimeline();

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col pt-8 pb-12 px-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-emerald-100 p-3 rounded-full">
          <History className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">Farmer History & Audit</h1>
          <p className="text-slate-500">
            View lifetime records or filter by individual dynamic accounting cycles.
          </p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:w-96">
          <Search className="w-5 h-5 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Search by Name, Farmer ID, Phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
          />
        </div>

        {/* Dynamic Cycle Filter */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <Calendar className="w-5 h-5 text-slate-500" />
          <label className="text-sm font-medium text-slate-700 whitespace-nowrap">
            Cycle View:
          </label>
          <select
            value={selectedCycleId}
            onChange={(e) => handleCycleChange(e.target.value)}
            className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none font-semibold text-slate-800 bg-white"
          >
            <option value="ALL">ALL (Complete Lifetime Audit)</option>
            {farmerData?.allCycles?.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.label} {c.isClosed ? "[CLOSED]" : "[ACTIVE]"}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content Area */}
      {!farmerData ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
            <h2 className="font-bold text-slate-800">Select a Farmer to View History</h2>
            <span className="text-xs text-slate-500">{filteredFarmers.length} registered farmers</span>
          </div>
          <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
            {filteredFarmers.length === 0 ? (
              <div className="p-8 text-center text-slate-400">No farmers found matching query</div>
            ) : (
              filteredFarmers.map((f) => (
                <div
                  key={f.id}
                  onClick={() => fetchFarmerHistory(f.farmerNo)}
                  className="p-4 hover:bg-emerald-50/50 cursor-pointer transition-colors flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-800">{f.name}</span>
                      <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-mono">
                        #{f.farmerNo}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">Phone: {f.phone}</p>
                  </div>
                  <span className="text-sm text-emerald-700 font-medium">View History →</span>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6 flex-1">
          {/* Active Farmer Header Card */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-bold text-slate-800">{farmerData.name}</h2>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full">
                  ID: #{farmerData.farmerNo}
                </span>
                {selectedCycleId !== "ALL" && (
                  <span className="text-xs bg-purple-100 text-purple-800 font-bold px-3 py-1 rounded-full">
                    {farmerData.allCycles?.find((c: any) => c.id === selectedCycleId)?.shortLabel || "Filtered Cycle"}
                  </span>
                )}
              </div>
              <p className="text-slate-500 text-sm mt-1">Phone: {farmerData.phone}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setFarmerData(null)}
                className="px-4 py-2 border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors"
              >
                Change Farmer
              </button>
              <button
                onClick={() => generatePDF(farmerData)}
                className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white px-5 py-2 rounded-lg text-sm font-medium transition-all shadow-sm"
              >
                <Download className="w-4 h-4" /> Download PDF Statement
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">Bills (Purchases)</span>
              <p className="text-2xl font-bold text-slate-800 mt-1">{farmerData.bills?.length || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">Cash Transactions</span>
              <p className="text-2xl font-bold text-slate-800 mt-1">{farmerData.cashTransactions?.length || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">Crop Logs</span>
              <p className="text-2xl font-bold text-slate-800 mt-1">{farmerData.cropLogs?.length || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200">
              <span className="text-xs text-slate-400 font-medium">Annual Settlements</span>
              <p className="text-2xl font-bold text-purple-700 mt-1">{farmerData.annualSettlements?.length || 0}</p>
            </div>
          </div>

          {/* Chronological Timeline Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <History className="w-5 h-5 text-slate-600" /> Full Audit Trail
              </h3>
              <span className="text-xs bg-slate-200 text-slate-700 font-semibold px-2.5 py-0.5 rounded-full">
                {timeline.length} events
              </span>
            </div>

            <table className="w-full text-left text-sm">
              <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Record ID</th>
                  <th className="px-4 py-3 font-semibold">Activity Type</th>
                  <th className="px-4 py-3 font-semibold">Details</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeline.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                      No events recorded in this accounting cycle.
                    </td>
                  </tr>
                ) : (
                  timeline.map((item: any, idx: number) => {
                    let typeIcon = null;
                    let typeLabel = "";
                    let details = "";
                    let amountStr = "";
                    let amountColor = "";

                    if (item.timelineType === "BILL") {
                      typeIcon = <FileText className="w-4 h-4 text-blue-500" />;
                      typeLabel = `Purchase (${item.category})`;
                      details = `${item.product} (Qty: ${item.quantity})`;
                      amountStr = `Owes ₹${item.total.toFixed(2)}`;
                      amountColor = "text-slate-800 font-medium";
                    } else if (item.timelineType === "CASH") {
                      typeIcon =
                        item.type === "TAKEN" ? (
                          <ArrowDownCircle className="w-4 h-4 text-amber-600" />
                        ) : (
                          <ArrowUpCircle className="w-4 h-4 text-green-600" />
                        );
                      typeLabel = item.type === "TAKEN" ? "Money Taken" : "Money Given";
                      details = item.note || (item.type === "TAKEN" ? "Farmer borrowed cash" : "Farmer repaid cash");
                      amountStr = item.type === "TAKEN" ? `Owes ₹${item.amount.toFixed(2)}` : `Paid ₹${item.amount.toFixed(2)}`;
                      amountColor = item.type === "TAKEN" ? "text-amber-700 font-medium" : "text-green-700 font-medium";
                    } else if (item.timelineType === "CROP_LOG") {
                      typeIcon = <Sprout className="w-4 h-4 text-emerald-600" />;
                      typeLabel = `Crop Sale (${item.cropType})`;
                      const bagsArr = Array.isArray(item.bagWeights)
                        ? item.bagWeights
                        : JSON.parse(item.bagWeights || "[]");
                      details = `${bagsArr.length} bags, ${(item.totalWeight / 100).toFixed(2)} qtl @ ₹${item.price || 0}/qtl`;
                      const total = (item.totalWeight / 100) * (item.price || 0);
                      amountStr = `Value ₹${total.toFixed(2)}`;
                      amountColor = "text-emerald-700 font-bold";
                    } else if (item.timelineType === "ANNUAL_SETTLEMENT") {
                      typeIcon = <ShieldCheck className="w-4 h-4 text-purple-600" />;
                      typeLabel = `Annual Settlement`;
                      details = `${item.academicYear || "Settlement"} | Status: ${item.status.replace(/_/g, " ")} | Decision: ${item.paymentStatus}`;
                      amountStr = `Final ₹${item.totalAmount.toFixed(2)}`;
                      amountColor = "text-purple-800 font-black";
                    }

                    const isSettlementEvent = item.timelineType === "ANNUAL_SETTLEMENT";

                    return (
                      <tr
                        key={`${item.timelineType}-${item.id || idx}`}
                        className={`hover:bg-slate-50 transition-colors ${
                          isSettlementEvent ? "bg-purple-50/50 border-y-2 border-purple-200 font-bold" : ""
                        }`}
                      >
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {format(item.dateObj, "dd/MM/yyyy")}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-500">
                          #{item.billNo || item.receiptNo || item.logNo || item.generatedReceiptNo || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                            {typeIcon} {typeLabel}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {details}
                          {item.timelineType === "CROP_LOG" && (
                            <span
                              className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                                item.isSettled ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {item.isSettled ? "Settled ✓" : "Unsettled"}
                            </span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right ${amountColor}`}>{amountStr}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
