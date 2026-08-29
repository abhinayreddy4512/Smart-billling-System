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
import { getAcademicYearOptions } from "@/lib/academicYear";

export default function FarmerHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAY, setSelectedAY] = useState("ALL");
  const ayOptions = ["ALL", ...getAcademicYearOptions()];

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

  const fetchFarmerHistory = async (farmerNo: string, ay: string = selectedAY) => {
    setLoading(true);
    setError("");
    setFarmerData(null);
    setSelectedFarmerNo(farmerNo);

    try {
      const res = await fetch(
        `/api/farmers/${farmerNo.toUpperCase()}/history?academicYear=${ay}`
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

  const handleAYChange = (newAY: string) => {
    setSelectedAY(newAY);
    if (selectedFarmerNo) {
      fetchFarmerHistory(selectedFarmerNo, newAY);
    }
  };

  const handleViewPdfDirectly = async (farmer: any) => {
    try {
      const res = await fetch(
        `/api/farmers/${farmer.farmerNo}/history?academicYear=${selectedAY}`
      );
      if (res.ok) {
        const data = await res.json();
        generatePDF(data);
      }
    } catch (err) {
      console.error("Error generating PDF", err);
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
    doc.text(`Business Year: ${selectedAY === "ALL" ? "All Years Complete Audit" : selectedAY}`, 14, currentY);
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
      doc.text("1. Billing & Purchases", 14, currentY);

      const billRows = dataToExport.bills.map((b: any) => [
        format(new Date(b.date), "dd/MM/yyyy"),
        b.billNo,
        `${b.category}: ${b.product}`,
        b.quantity,
        `Rs. ${b.total.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: currentY + 4,
        head: [["Date", "Bill ID", "Item", "Qty", "Total Cost"]],
        body: billRows,
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185] },
        styles: { fontSize: 8.5 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    // SECTION 2: Cash Transactions
    if (dataToExport.cashTransactions && dataToExport.cashTransactions.length > 0) {
      if (currentY > 230) { doc.addPage(); currentY = 20; }
      doc.setFontSize(13);
      doc.setTextColor(39, 174, 96);
      doc.setFont("helvetica", "bold");
      doc.text("2. Cash Transactions & Carry Forwards", 14, currentY);

      const cashRows = dataToExport.cashTransactions.map((c: any) => [
        format(new Date(c.date), "dd/MM/yyyy"),
        c.receiptNo || "-",
        c.type === "TAKEN" ? "Money Taken" : "Money Given",
        c.note || (c.type === "TAKEN" ? "Cash Loan" : "Repayment"),
        `Rs. ${c.amount.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: currentY + 4,
        head: [["Date", "Receipt ID", "Type", "Note / Description", "Amount"]],
        body: cashRows,
        theme: "grid",
        headStyles: { fillColor: [39, 174, 96] },
        styles: { fontSize: 8.5 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    // SECTION 3: Crop Sales
    if (dataToExport.cropLogs && dataToExport.cropLogs.length > 0) {
      if (currentY > 230) { doc.addPage(); currentY = 20; }
      doc.setFontSize(13);
      doc.setTextColor(211, 84, 0);
      doc.setFont("helvetica", "bold");
      doc.text("3. Crop Entries (Cotton & Mirchi)", 14, currentY);

      const cropRows = dataToExport.cropLogs.map((c: any) => {
        const bagsArr = Array.isArray(c.bagWeights)
          ? c.bagWeights
          : JSON.parse(c.bagWeights || "[]");
        const total = (c.totalWeight / 100) * (c.price || 0);
        return [
          format(new Date(c.date), "dd/MM/yyyy"),
          c.logNo,
          c.cropType,
          `${bagsArr.length} bags (${(c.totalWeight / 100).toFixed(2)} qtl)`,
          `Rs. ${total.toFixed(2)}`,
          c.isSettled ? "Settled ✓" : "Unsettled",
        ];
      });

      autoTable(doc, {
        startY: currentY + 4,
        head: [["Date", "Log ID", "Crop", "Weight", "Total Value", "Status"]],
        body: cropRows,
        theme: "grid",
        headStyles: { fillColor: [211, 84, 0] },
        styles: { fontSize: 8.5 },
      });
      currentY = (doc as any).lastAutoTable.finalY + 12;
    }

    // SECTION 4: Annual Settlement Statements
    if (dataToExport.annualSettlements && dataToExport.annualSettlements.length > 0) {
      if (currentY > 230) { doc.addPage(); currentY = 20; }
      doc.setFontSize(13);
      doc.setTextColor(142, 68, 173);
      doc.setFont("helvetica", "bold");
      doc.text("4. Annual Settlement Records", 14, currentY);

      const setRows = dataToExport.annualSettlements.map((s: any) => [
        s.academicYear || "-",
        format(new Date(s.periodEnd), "dd/MM/yyyy"),
        s.status.replace(/_/g, " "),
        s.paymentStatus,
        `Rs. ${s.totalAmount.toFixed(2)}`,
      ]);

      autoTable(doc, {
        startY: currentY + 4,
        head: [["Academic Year", "Settlement Date", "Status", "Payment Status", "Final Amount"]],
        body: setRows,
        theme: "grid",
        headStyles: { fillColor: [142, 68, 173] },
        styles: { fontSize: 8.5 },
      });
    }

    window.open(doc.output("bloburl"), "_blank");
  };

  const handleExportPDF = () => {
    generatePDF(farmerData);
  };

  const timeline = getTimeline();

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col pt-6 pb-16 px-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 p-3 rounded-xl text-emerald-700">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-green-950">Farmer Audit History</h1>
            <p className="text-slate-500 text-xs">
              View complete historical log of purchases, cash loans, crops & settlements by Business Year.
            </p>
          </div>
        </div>

        {/* Global Business Year Filter */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
          <span className="text-xs font-semibold text-slate-600 pl-2 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Business Year:
          </span>
          <select
            value={selectedAY}
            onChange={(e) => handleAYChange(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 font-bold text-sm text-emerald-800 outline-none cursor-pointer focus:ring-2 focus:ring-emerald-500"
          >
            {ayOptions.map((ay) => (
              <option key={ay} value={ay}>
                {ay === "ALL" ? "All Business Years" : ay}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Search Bar & Farmer Selection List */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-8">
        <div className="mb-4">
          <label htmlFor="searchQuery" className="block text-xs font-semibold text-slate-600 mb-1.5">
            Search Farmers
          </label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="searchQuery"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Farmer Name, ID, or Phone..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 text-xs rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[300px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-slate-50 z-10 border-b border-slate-200">
              <tr className="text-slate-600 font-semibold uppercase">
                <th className="px-4 py-3">Farmer ID</th>
                <th className="px-4 py-3">Farmer Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">Loading farmers...</td>
                </tr>
              ) : filteredFarmers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">No farmers found.</td>
                </tr>
              ) : (
                filteredFarmers.map((farmer) => (
                  <tr
                    key={farmer.id}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors ${
                      selectedFarmerNo === farmer.farmerNo ? "bg-emerald-50/60" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-emerald-800">{farmer.farmerNo}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800">{farmer.name}</td>
                    <td className="px-4 py-3 text-slate-500">{farmer.phone}</td>
                    <td className="px-4 py-3 text-right space-x-2">
                      <button
                        onClick={() => fetchFarmerHistory(farmer.farmerNo)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-3 py-1 rounded-lg text-xs transition-all inline-flex items-center gap-1"
                      >
                        <History className="w-3.5 h-3.5" /> View Timeline
                      </button>
                      <button
                        onClick={() => handleViewPdfDirectly(farmer)}
                        className="bg-slate-800 hover:bg-slate-900 text-white font-medium px-3 py-1 rounded-lg text-xs transition-all inline-flex items-center gap-1"
                      >
                        <FileText className="w-3.5 h-3.5" /> PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Timeline Display */}
      {farmerData && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col mb-12">
          {/* Timeline Header */}
          <div className="p-5 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-800">{farmerData.name}</h2>
                <span className="text-xs bg-emerald-100 text-emerald-800 font-bold px-3 py-1 rounded-full">
                  {selectedAY === "ALL" ? "All Business Years" : `AY ${selectedAY}`}
                </span>
              </div>
              <p className="text-slate-500 text-xs mt-1">
                ID: <strong>{farmerData.farmerNo}</strong> | Phone: {farmerData.phone}
              </p>
            </div>

            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-slate-800 hover:bg-green-950 text-white px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm"
            >
              <Download className="w-4 h-4" /> Export History PDF
            </button>
          </div>

          {/* Timeline Table */}
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-600 font-semibold uppercase">
                  <th className="px-4 py-3 border-b">Date</th>
                  <th className="px-4 py-3 border-b">Ref / ID</th>
                  <th className="px-4 py-3 border-b">Category / Event</th>
                  <th className="px-4 py-3 border-b">Description & Details</th>
                  <th className="px-4 py-3 border-b text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeline.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                      No records found for business year {selectedAY}.
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
                      typeLabel = `Annual Settlement (${item.academicYear})`;
                      details = `Status: ${item.status.replace(/_/g, " ")} | Payment: ${item.paymentStatus}`;
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
