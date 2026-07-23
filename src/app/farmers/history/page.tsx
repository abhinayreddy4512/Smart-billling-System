"use client";

import { useState, useEffect, useRef } from "react";
import { History, Search, Download, FileText, User, IndianRupee, Sprout, HandCoins, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export default function FarmerHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [allFarmers, setAllFarmers] = useState<any[]>([]);
  const [filteredFarmers, setFilteredFarmers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [farmerData, setFarmerData] = useState<any>(null);

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
        allFarmers.filter(f => 
          f.name.toLowerCase().includes(q) || 
          f.farmerNo.toLowerCase().includes(q) ||
          f.phone.includes(q)
        )
      );
    }
  }, [searchQuery, allFarmers]);

  const fetchFarmerHistory = async (id: string) => {
    setLoading(true);
    setError("");
    setFarmerData(null);
    

    try {
      const res = await fetch(`/api/farmers/${id}/history`);
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

  const handleViewPdfDirectly = async (farmer: any) => {
    try {
      const res = await fetch(`/api/farmers/${farmer.farmerNo}/history`);
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
    farmerData.bills?.forEach((b: any) => tl.push({ ...b, timelineType: 'BILL', dateObj: new Date(b.date) }));
    farmerData.cashTransactions?.forEach((c: any) => tl.push({ ...c, timelineType: 'CASH', dateObj: new Date(c.date) }));
    farmerData.cropLogs?.forEach((c: any) => tl.push({ ...c, timelineType: 'CROP_LOG', dateObj: new Date(c.date) }));
    // Crop Settlements are no longer shown as standalone timeline items per user request
    return tl.sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());
  };

  const generatePDF = (dataToExport: any) => {
    if (!dataToExport) return;

    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text("Farmer Full History", 14, 22);

    // Farmer Info
    doc.setFontSize(12);
    doc.text(`Farmer ID: ${dataToExport.farmerNo}`, 14, 32);
    doc.text(`Name: ${dataToExport.name}`, 14, 38);
    doc.text(`Phone: ${dataToExport.phone}`, 14, 44);

    let currentY = 55;

    // SECTION 1: Billing (Purchases)
    if (dataToExport.bills && dataToExport.bills.length > 0) {
      doc.setFontSize(14);
      doc.text("Billing & Purchases", 14, currentY);
      
      const billRows = dataToExport.bills.map((b: any) => [
        format(new Date(b.date), "dd/MM/yyyy"),
        b.billNo,
        `${b.category}: ${b.product}`,
        b.quantity,
        `Rs. ${b.total.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [["Date", "Bill ID", "Item", "Qty", "Total Cost"]],
        body: billRows,
        theme: "grid",
        headStyles: { fillColor: [41, 128, 185] },
        styles: { overflow: 'linebreak', cellWidth: 'wrap' }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // SECTION 2: Cash Transactions
    if (dataToExport.cashTransactions && dataToExport.cashTransactions.length > 0) {
      doc.setFontSize(14);
      doc.text("Cash Transactions", 14, currentY);
      
      const cashRows = dataToExport.cashTransactions.map((c: any) => [
        format(new Date(c.date), "dd/MM/yyyy"),
        c.receiptNo,
        c.type === "TAKEN" ? "Loan Taken" : "Repayment",
        `Rs. ${c.amount.toFixed(2)}`
      ]);

      autoTable(doc, {
        startY: currentY + 5,
        head: [["Date", "Receipt ID", "Type", "Amount"]],
        body: cashRows,
        theme: "grid",
        headStyles: { fillColor: [39, 174, 96] },
        styles: { overflow: 'linebreak', cellWidth: 'wrap' }
      });
      currentY = (doc as any).lastAutoTable.finalY + 15;
    }

    // SECTION 3: Crop Sales
    if (dataToExport.cropLogs && dataToExport.cropLogs.length > 0) {
      doc.setFontSize(14);
      doc.text("Crop Sales", 14, currentY);
      
      const cropRows = dataToExport.cropLogs.map((c: any) => {
        const bagsArr = Array.isArray(c.bagWeights) ? c.bagWeights : JSON.parse(c.bagWeights || "[]");
        const total = (c.totalWeight / 100) * (c.price || 0);
        return [
          format(new Date(c.date), "dd/MM/yyyy"),
          c.logNo,
          c.cropType,
          `${bagsArr.length} bags (${c.totalWeight}kg)`,
          `Rs. ${total.toFixed(2)}`
        ];
      });

      autoTable(doc, {
        startY: currentY + 5,
        head: [["Date", "Log ID", "Crop", "Quantity", "Total Value"]],
        body: cropRows,
        theme: "grid",
        headStyles: { fillColor: [211, 84, 0] },
        styles: { overflow: 'linebreak', cellWidth: 'wrap' }
      });
    }

    const pdfBlobUrl = doc.output("bloburl");
    window.open(pdfBlobUrl, "_blank");
  };

  const handleExportPDF = () => {
    generatePDF(farmerData);
  };

  const timeline = getTimeline();

  // Crop settlement status calculation
  let cropPending = 0;
  let hasCrops = false;
  if (farmerData) {
    const totalCropValue = (farmerData.cropLogs || []).reduce((sum: number, log: any) => sum + ((log.totalWeight / 100) * (log.price || 0)), 0);
    const totalSettled = (farmerData.cropSettlements || []).reduce((sum: number, s: any) => sum + s.amount, 0);
    cropPending = totalCropValue - totalSettled;
    hasCrops = (farmerData.cropLogs || []).length > 0;
  }

  return (
    <div className="max-w-6xl mx-auto h-full flex flex-col pt-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-emerald-100 p-3 rounded-full">
          <History className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">Farmer Full History</h1>
          <p className="text-slate-500">View complete timeline of purchases, cash, and crops.</p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-8">
        <div className="mb-6">
          <label htmlFor="searchQuery" className="block text-sm font-medium text-slate-700 mb-2">
            Search Farmers
          </label>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="searchQuery"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by Name, ID, or Phone..."
              className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <div className="overflow-x-auto border border-slate-200 rounded-lg max-h-[400px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-slate-50 z-10">
              <tr className="text-slate-600 text-sm uppercase tracking-wider shadow-sm">
                <th className="px-6 py-4 font-semibold border-b">ID</th>
                <th className="px-6 py-4 font-semibold border-b">Name</th>
                <th className="px-6 py-4 font-semibold border-b">Phone</th>
                <th className="px-6 py-4 font-semibold border-b text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Loading farmers...</td>
                </tr>
              ) : filteredFarmers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">No farmers found.</td>
                </tr>
              ) : (
                filteredFarmers.map((farmer) => (
                  <tr key={farmer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-700">{farmer.farmerNo}</td>
                    <td className="px-6 py-4 text-sm text-slate-900 font-semibold">{farmer.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{farmer.phone}</td>
                    <td className="px-6 py-4 text-right space-x-3">
                      <button
                        onClick={() => fetchFarmerHistory(farmer.farmerNo)}
                        className="text-emerald-600 font-medium hover:text-emerald-800 text-sm inline-flex items-center gap-1"
                      >
                        <History className="w-4 h-4" /> View UI
                      </button>
                      <button
                        onClick={() => handleViewPdfDirectly(farmer)}
                        className="bg-slate-800 text-white px-3 py-1.5 rounded text-sm font-medium hover:bg-slate-700 transition-colors inline-flex items-center gap-1"
                      >
                        <FileText className="w-4 h-4" /> View PDF
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {farmerData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col mb-12">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{farmerData.name}</h2>
              <p className="text-slate-500 text-sm mt-1 flex items-center gap-4">
                <span>ID: <strong className="text-slate-700">{farmerData.farmerNo}</strong></span>
                <span>Phone: <strong className="text-slate-700">{farmerData.phone}</strong></span>
              </p>
            </div>

            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 bg-slate-800 hover:bg-green-950 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all shadow-sm"
            >
              <Download className="w-4 h-4" />
              Export PDF
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-600 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold border-b">Date</th>
                  <th className="px-6 py-4 font-semibold border-b">Bill ID</th>
                  <th className="px-6 py-4 font-semibold border-b">Type</th>
                  <th className="px-6 py-4 font-semibold border-b">Details</th>
                  <th className="px-6 py-4 font-semibold border-b text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeline.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                      <div className="flex flex-col items-center gap-2">
                        <History className="w-8 h-8 text-slate-300" />
                        <p>No history found for this farmer.</p>
                      </div>
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
                      typeLabel = "Purchase";
                      details = `${item.category}: ${item.product} (x${item.quantity})`;
                      amountStr = `Owes ₹${item.total.toFixed(2)}`;
                      amountColor = "text-slate-800";
                    } else if (item.timelineType === "CASH") {
                      typeIcon = item.type === "TAKEN" ? <ArrowDownCircle className="w-4 h-4 text-red-500" /> : <ArrowUpCircle className="w-4 h-4 text-green-500" />;
                      typeLabel = item.type === "TAKEN" ? "Cash Loan" : "Repayment";
                      details = item.type === "TAKEN" ? "Farmer borrowed cash" : "Farmer repaid cash";
                      amountStr = item.type === "TAKEN" ? `Owes ₹${item.amount.toFixed(2)}` : `Paid ₹${item.amount.toFixed(2)}`;
                      amountColor = item.type === "TAKEN" ? "text-slate-800" : "text-green-700";
                    } else if (item.timelineType === "CROP_LOG") {
                      typeIcon = <Sprout className="w-4 h-4 text-green-600" />;
                      typeLabel = "Crop Sale";
                      const bagsArr = Array.isArray(item.bagWeights) ? item.bagWeights : JSON.parse(item.bagWeights || "[]");
                      details = `${item.cropType}: ${bagsArr.length} bags, ${item.totalWeight}kg @ ₹${item.price || 0}/100kg`;
                      const total = (item.totalWeight / 100) * (item.price || 0);
                      amountStr = `Value ₹${total.toFixed(2)}`;
                      amountColor = "text-emerald-700 font-bold";
                    }

                    return (
                      <tr key={`${item.timelineType}-${item.id || idx}`} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-4 text-sm text-slate-600 whitespace-nowrap">
                          {format(item.dateObj, "dd/MM/yyyy HH:mm")}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-500">
                          #{item.billNo || item.receiptNo || item.logNo || "-"}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 font-medium text-slate-700">
                            {typeIcon} {typeLabel}
                          </div>
                        </td>
                        <td className="px-6 py-4 text-slate-600 text-sm">
                          {details}
                          {item.timelineType === "CROP_LOG" && (
                            <div className="mt-1">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.isSettled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {item.isSettled ? 'Settled' : 'Not Settled'}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className={`px-6 py-4 text-right font-medium ${amountColor}`}>
                          {amountStr}
                        </td>
                      </tr>
                    )
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
