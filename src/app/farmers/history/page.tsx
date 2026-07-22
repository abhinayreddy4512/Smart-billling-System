"use client";

import { useState, useEffect, useRef } from "react";
import { History, Search, Download, FileText, User, IndianRupee, Sprout, HandCoins, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export default function FarmerHistoryPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [farmerData, setFarmerData] = useState<any>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Debounced search for suggestions
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery.trim().length > 0) {
        try {
          const res = await fetch(`/api/farmers/search?q=${encodeURIComponent(searchQuery)}`);
          if (res.ok) {
            const data = await res.json();
            setSearchResults(data);
            setShowDropdown(true);
          }
        } catch (err) {
          console.error("Failed to fetch suggestions");
        }
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  // Click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchFarmerHistory = async (id: string) => {
    setLoading(true);
    setError("");
    setFarmerData(null);
    setShowDropdown(false);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery) return;
    
    // If they press enter and there's a result, pick the first one, or try fetching exactly
    if (searchResults.length > 0) {
      fetchFarmerHistory(searchResults[0].id);
      setSearchQuery(searchResults[0].name);
    } else {
      fetchFarmerHistory(searchQuery.toUpperCase());
    }
  };

  const handleSelectFarmer = (farmer: any) => {
    setSearchQuery(farmer.name);
    fetchFarmerHistory(farmer.id);
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

  const handleExportPDF = () => {
    if (!farmerData) return;

    const doc = new jsPDF();

    // Title
    doc.setFontSize(20);
    doc.text("Farmer Full History", 14, 22);

    // Farmer Info
    doc.setFontSize(12);
    doc.text(`Farmer ID: ${farmerData.id}`, 14, 32);
    doc.text(`Name: ${farmerData.name}`, 14, 38);
    doc.text(`Phone: ${farmerData.phone}`, 14, 44);

    // Table Data
    const tableColumn = ["Date", "Bill ID", "Type", "Details", "Amount"];
    const tableRows: any[] = [];
    
    const timeline = getTimeline();

    timeline.forEach((item: any) => {
      let type = "";
      let details = "";
      let amountStr = "";

      if (item.timelineType === "BILL") {
        type = "Purchase";
        details = `${item.category}: ${item.product} (x${item.quantity})`;
        amountStr = `Owes ₹${item.total.toFixed(2)}`;
      } else if (item.timelineType === "CASH") {
        type = item.type === "TAKEN" ? "Cash Loan" : "Repayment";
        details = item.type === "TAKEN" ? "Farmer borrowed cash" : "Farmer repaid cash";
        amountStr = item.type === "TAKEN" ? `Owes ₹${item.amount.toFixed(2)}` : `Paid ₹${item.amount.toFixed(2)}`;
      } else if (item.timelineType === "CROP_LOG") {
        type = "Crop Sale";
        const bagsArr = Array.isArray(item.bagWeights) ? item.bagWeights : JSON.parse(item.bagWeights || "[]");
        details = `${item.cropType}: ${bagsArr.length} bags, ${item.totalWeight}kg @ ₹${item.price || 0}/100kg\nStatus: ${item.isSettled ? 'Settled' : 'Not Settled'}`;
        const total = (item.totalWeight / 100) * (item.price || 0);
        amountStr = `Value ₹${total.toFixed(2)}`;
      }

      tableRows.push([
        format(item.dateObj, "dd/MM/yyyy"),
        `#${item.id.slice(-6).toUpperCase()}`,
        type,
        details,
        amountStr
      ]);
    });

    autoTable(doc, {
      startY: 50,
      head: [tableColumn],
      body: tableRows,
      theme: "grid",
      headStyles: { fillColor: [41, 128, 185] },
    });

    const pdfBlobUrl = doc.output("bloburl");
    window.open(pdfBlobUrl, "_blank");
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
        <form onSubmit={handleSearch} className="flex gap-4 items-end">
          <div className="flex-1 space-y-2 relative" ref={dropdownRef}>
            <label htmlFor="searchQuery" className="block text-sm font-medium text-slate-700">
              Search by Farmer Name, ID, or Phone
            </label>
            <input
              type="text"
              id="searchQuery"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => {
                if (searchResults.length > 0) setShowDropdown(true);
              }}
              placeholder="e.g. F-001 or 9876543210"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              autoComplete="off"
            />
            {/* Suggestions Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <ul className="py-1">
                  {searchResults.map((farmer) => (
                    <li
                      key={farmer.id}
                      onClick={() => handleSelectFarmer(farmer)}
                      className="px-4 py-2 hover:bg-emerald-50 cursor-pointer flex justify-between items-center transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="bg-emerald-100 p-1.5 rounded-full">
                          <User className="w-4 h-4 text-emerald-700" />
                        </div>
                        <div>
                          <p className="font-medium text-slate-800">{farmer.name}</p>
                          <p className="text-xs text-slate-500">ID: {farmer.id} | Phone: {farmer.phone}</p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 h-[42px] rounded-lg font-medium transition-all disabled:opacity-70"
          >
            {loading ? "Searching..." : <><Search className="w-4 h-4" /> Search</>}
          </button>
        </form>

        {error && (
          <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-lg border border-red-200">
            {error}
          </div>
        )}
      </div>

      {farmerData && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col mb-12">
          <div className="p-6 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">{farmerData.name}</h2>
              <p className="text-slate-500 text-sm mt-1 flex items-center gap-4">
                <span>ID: <strong className="text-slate-700">{farmerData.id}</strong></span>
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
                          #{item.id.slice(-6).toUpperCase()}
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
