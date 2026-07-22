import React, { useState } from "react";
import { CheckCircle2, Save, FileText, IndianRupee } from "lucide-react";
import { format } from "date-fns";

interface SettlementProps {
  farmerId: string;
}

export default function SettlementSection({ farmerId }: SettlementProps) {
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [cropLogs, setCropLogs] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  
  // State for selecting bills to settle
  const [selectedLogs, setSelectedLogs] = useState<string[]>([]);

  const fetchHistory = async () => {
    if (!farmerId) return;
    try {
      const res = await fetch(`/api/settlement/${farmerId}`);
      if (!res.ok) throw new Error("Failed to fetch settlement history");
      const data = await res.json();
      setCropLogs(data.cropLogs || []);
      setSettlements(data.settlements || []);
      setSelectedLogs([]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  React.useEffect(() => {
    setCropLogs([]);
    setSettlements([]);
    setError("");
    setSelectedLogs([]);
    fetchHistory();
  }, [farmerId]);

  const toggleSelect = (logId: string) => {
    setSelectedLogs(prev => 
      prev.includes(logId) ? prev.filter(id => id !== logId) : [...prev, logId]
    );
  };

  const toggleSelectAll = () => {
    const unsettled = cropLogs.filter(log => !log.isSettled).map(log => log.id);
    if (selectedLogs.length === unsettled.length) {
      setSelectedLogs([]);
    } else {
      setSelectedLogs(unsettled);
    }
  };

  const selectedAmount = cropLogs
    .filter(log => selectedLogs.includes(log.id))
    .reduce((sum, log) => sum + ((log.totalWeight / 100) * (log.price || 0)), 0);

  const handleSave = async () => {
    if (selectedLogs.length === 0) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ farmerId, cropLogIds: selectedLogs, date }),
      });
      if (!res.ok) throw new Error("Failed to record settlement");
      setSaveStatus("Settlement recorded successfully!");
      setSelectedLogs([]);
      setTimeout(() => setSaveStatus(""), 2000);
      fetchHistory();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalCropAmount = cropLogs.reduce((sum, log) => sum + ((log.totalWeight / 100) * (log.price || 0)), 0);
  const totalSettledAmount = settlements.reduce((sum, s) => sum + s.amount, 0);
  const pendingAmount = totalCropAmount - totalSettledAmount;
  const unsettledCount = cropLogs.filter(log => !log.isSettled).length;

  return (
    <div className="mt-8 bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
      <div className="flex justify-between items-center border-b border-slate-200 pb-4">
        <h3 className="text-lg font-bold text-slate-800">Cotton & Mirchi Settlement</h3>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {/* Crop Sales History (Logs) */}
      <div>
        <div className="flex justify-between items-end mb-3">
          <h4 className="font-semibold text-slate-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-500" /> Unsettled Crop Sales
          </h4>
          {unsettledCount > 0 && (
            <button onClick={toggleSelectAll} className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
              {selectedLogs.length === unsettledCount ? "Deselect All" : "Select All"}
            </button>
          )}
        </div>
        
        <div className="overflow-x-auto border border-slate-200 rounded-lg">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-4 py-3 border-b w-10"></th>
                <th className="px-4 py-3 border-b">Bill ID</th>
                <th className="px-4 py-3 border-b">Date</th>
                <th className="px-4 py-3 border-b">Crop</th>
                <th className="px-4 py-3 border-b text-right">Bags</th>
                <th className="px-4 py-3 border-b text-right">Weight (kg)</th>
                <th className="px-4 py-3 border-b text-right">Price (/100kg)</th>
                <th className="px-4 py-3 border-b text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cropLogs.filter(log => !log.isSettled).length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No unsettled bills found.</td></tr>
              ) : (
                cropLogs.filter(log => !log.isSettled).map(log => {
                  const bagsArr = Array.isArray(log.bagWeights) ? log.bagWeights : JSON.parse(log.bagWeights || "[]");
                  const bagsCount = bagsArr.length;
                  const total = (log.totalWeight / 100) * (log.price || 0);
                  const isSelected = selectedLogs.includes(log.id);
                  const billNo = `#${log.id.slice(-6).toUpperCase()}`;
                  
                  return (
                    <tr key={log.id} className={`hover:bg-slate-50 cursor-pointer ${isSelected ? 'bg-emerald-50/50' : ''}`} onClick={() => toggleSelect(log.id)}>
                      <td className="px-4 py-3">
                        <input type="checkbox" checked={isSelected} readOnly className="w-4 h-4 text-emerald-600 rounded focus:ring-emerald-500" />
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-700">{billNo}</td>
                      <td className="px-4 py-3 text-slate-600">{format(new Date(log.date), "dd/MM/yy")}</td>
                      <td className="px-4 py-3 font-medium">{log.cropType}</td>
                      <td className="px-4 py-3 text-right">{bagsCount}</td>
                      <td className="px-4 py-3 text-right">{log.totalWeight}</td>
                      <td className="px-4 py-3 text-right">₹{log.price || 0}</td>
                      <td className="px-4 py-3 text-right font-medium text-slate-800">₹{total.toFixed(2)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settle Form */}
      <div className="bg-slate-50 p-5 rounded-lg border border-slate-200">
        <h4 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <IndianRupee className="w-4 h-4 text-emerald-600" /> Settle Selected Bills
        </h4>
        
        <div className="flex flex-col md:flex-row gap-6 items-start md:items-end">
          <div className="flex-1 bg-white p-4 rounded-lg border border-emerald-100 shadow-sm w-full md:w-auto">
            <p className="text-sm text-slate-500 mb-1">Total value to settle</p>
            <p className="text-2xl font-bold text-emerald-700">₹{selectedAmount.toFixed(2)}</p>
            <p className="text-xs text-emerald-600 mt-1">{selectedLogs.length} bill(s) selected</p>
          </div>
          
          <div className="w-full md:w-48">
            <label className="block text-xs text-slate-500 mb-1">Settlement Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg outline-none focus:ring-emerald-500"
            />
          </div>
          
          <button
            onClick={handleSave}
            disabled={loading || selectedLogs.length === 0}
            className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-lg disabled:opacity-50 font-medium transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-5 h-5" /> Settle Bills
          </button>
        </div>
        
        {saveStatus && (
          <div className="text-sm text-emerald-600 mt-4 flex items-center gap-1 font-medium bg-emerald-50 p-3 rounded-lg">
            <CheckCircle2 className="w-5 h-5" /> {saveStatus}
          </div>
        )}
      </div>

      {/* Settlement History */}
      <div>
        <h4 className="font-semibold text-slate-700 mb-3">Previous Settlements (Payments Made)</h4>
        {settlements.length === 0 ? (
          <p className="text-slate-500 text-sm">No settlements recorded yet.</p>
        ) : (
          <ul className="space-y-2">
            {settlements.map((s) => (
              <li key={s.id} className="flex justify-between items-center bg-slate-50 border border-slate-100 p-3 rounded-lg text-sm">
                <span className="text-slate-600 font-medium">{format(new Date(s.date), "MMMM d, yyyy")}</span>
                <span className="font-bold text-emerald-700">₹{s.amount.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
