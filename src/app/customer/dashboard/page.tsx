"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LogOut, FileText, Sprout, ArrowDownCircle, ArrowUpCircle, Download } from "lucide-react";
import { useRouter } from "next/navigation";

export default function CustomerDashboard() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchCustomerData();
  }, []);

  const fetchCustomerData = async () => {
    try {
      const res = await fetch("/api/customer/history");
      if (!res.ok) throw new Error("Failed to load customer data");
      const json = await res.json();
      setData(json);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      window.location.href = "/login";
    } catch (err) {
      console.error(err);
    }
  };

  const handleDownloadCropPDF = (c: any) => {
    if (!data) return;

    const doc = new jsPDF();
    
    // Header
    doc.setFontSize(20);
    doc.text("Crop Transaction Details", 14, 22);

    doc.setFontSize(12);
    doc.text(`Customer ID: ${data.farmerNo}`, 14, 32);
    doc.text(`Name: ${data.name}`, 14, 38);
    doc.text(`Phone: ${data.phone}`, 14, 44);
    doc.text(`Product: ${c.cropType}`, 14, 50);
    doc.text(`Date of Entry: ${format(new Date(c.date), "dd/MM/yyyy")}`, 14, 56);

    let currentY = 66;

    const bagsArr = Array.isArray(c.bagWeights) ? c.bagWeights : JSON.parse(c.bagWeights || "[]");
    const totalAmount = (c.totalWeight / 100) * (c.price || 0);

    const bagRows = bagsArr.map((weight: number, idx: number) => {
      return [`Bag ${idx + 1}`, `${weight} kg`];
    });

    bagRows.push([{ content: 'Total Weight', styles: { fontStyle: 'bold' } }, { content: `${c.totalWeight} kg`, styles: { fontStyle: 'bold' } }]);

    autoTable(doc, {
      startY: currentY,
      head: [["Bag", "Weight"]],
      body: bagRows,
      theme: "grid",
      headStyles: { fillColor: [211, 84, 0] },
      styles: { overflow: 'linebreak', cellWidth: 'wrap' }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;

    // Final Totals
    doc.setFontSize(12);
    doc.setFont("helvetica", "normal");
    doc.text(`Price: Rs. ${c.price || 0} per Quintal (100kg)`, 14, currentY);
    currentY += 10;
    doc.setFont("helvetica", "bold");
    doc.text(`Total Weight: ${c.totalWeight} kg`, 14, currentY);
    currentY += 10;
    doc.text(`Total Amount: Rs. ${totalAmount.toFixed(2)}`, 14, currentY);

    const pdfBlobUrl = doc.output("bloburl");
    window.open(pdfBlobUrl, "_blank");
  };

  const handleDownloadAllBills = () => {
    if (!data) return;
    const doc = new jsPDF();
    
    doc.setFontSize(20);
    doc.text("Transaction History", 14, 22);

    doc.setFontSize(12);
    doc.text(`Customer ID: ${data.farmerNo}`, 14, 32);
    doc.text(`Name: ${data.name}`, 14, 38);
    doc.text(`Phone: ${data.phone}`, 14, 44);
    doc.text(`Date Printed: ${format(new Date(), "dd/MM/yyyy")}`, 14, 50);

    let currentY = 60;

    if (data.bills && data.bills.length > 0) {
      doc.setFontSize(14);
      doc.text("Pesticides & Fertilizers Bills", 14, currentY);
      
      const billRows = data.bills.map((b: any) => [
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

    if (data.cashTransactions && data.cashTransactions.length > 0) {
      doc.setFontSize(14);
      doc.text("Money Lending & Borrowing", 14, currentY);
      
      const cashRows = data.cashTransactions.map((c: any) => [
        format(new Date(c.date), "dd/MM/yyyy"),
        c.receiptNo,
        c.type === "TAKEN" ? "Loan Taken (Borrowing)" : "Repayment (Lending)",
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
    }

    const pdfBlobUrl = doc.output("bloburl");
    window.open(pdfBlobUrl, "_blank");
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center">Loading your portal...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-500">Error: {error}</div>;
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Customer Header */}
      <header className="bg-white border-b border-slate-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-green-900">Customer Portal</h1>
          <p className="text-sm text-slate-500">Welcome, {data.name} (ID: {data.farmerNo})</p>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-slate-600 hover:text-red-600 transition-colors font-medium text-sm"
        >
          <LogOut className="w-4 h-4" /> Sign Out
        </button>
      </header>

      <main className="flex-1 p-8 max-w-7xl mx-auto w-full flex flex-col gap-8">
        
        {/* Cotton & Mirchi Summary */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Sprout className="w-5 h-5 text-orange-600" /> Cotton & Mirchi Transactions
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold border-b">Date</th>
                  <th className="px-6 py-4 font-semibold border-b">Product</th>
                  <th className="px-6 py-4 font-semibold border-b">Total Weight (kg)</th>
                  <th className="px-6 py-4 font-semibold border-b text-right">Total Price</th>
                  <th className="px-6 py-4 font-semibold border-b text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!data.cropLogs || data.cropLogs.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No crop transactions found.</td></tr>
                ) : (
                  data.cropLogs.map((c: any) => {
                    const total = (c.totalWeight / 100) * (c.price || 0);
                    return (
                      <tr key={c.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 text-sm text-slate-600">{format(new Date(c.date), "dd/MM/yyyy")}</td>
                        <td className="px-6 py-4 text-sm font-medium text-slate-800">{c.cropType}</td>
                        <td className="px-6 py-4 text-sm text-slate-600">{c.totalWeight}</td>
                        <td className="px-6 py-4 text-sm font-bold text-orange-700 text-right">Rs. {total.toFixed(2)}</td>
                        <td className="px-6 py-4 text-right">
                          <button 
                            onClick={() => handleDownloadCropPDF(c)}
                            className="inline-flex items-center gap-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          >
                            <Download className="w-3.5 h-3.5" /> View Total
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Pesticides & Fertilizers */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-blue-600" /> Pesticides & Fertilizers (Purchase History)
            </h2>
            {data.bills && data.bills.length > 0 && (
              <button 
                onClick={() => handleDownloadAllBills()}
                className="flex items-center gap-2 bg-blue-100 hover:bg-blue-200 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Download className="w-4 h-4" /> Download Bills PDF
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold border-b">Date</th>
                  <th className="px-6 py-4 font-semibold border-b">Bill No</th>
                  <th className="px-6 py-4 font-semibold border-b">Item</th>
                  <th className="px-6 py-4 font-semibold border-b">Quantity</th>
                  <th className="px-6 py-4 font-semibold border-b text-right">Total Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!data.bills || data.bills.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-slate-500">No purchase history found.</td></tr>
                ) : (
                  data.bills.map((b: any) => (
                    <tr key={b.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-600">{format(new Date(b.date), "dd/MM/yyyy")}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-500">#{b.billNo}</td>
                      <td className="px-6 py-4 text-sm text-slate-800">{b.category}: {b.product}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">{b.quantity}</td>
                      <td className="px-6 py-4 text-sm font-medium text-blue-700 text-right">Rs. {b.total.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Money Lending & Borrowing */}
        <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2 mb-6">
            <ArrowDownCircle className="w-5 h-5 text-green-600" /> Money Lending & Borrowing
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider">
                  <th className="px-6 py-4 font-semibold border-b">Date</th>
                  <th className="px-6 py-4 font-semibold border-b">Receipt No</th>
                  <th className="px-6 py-4 font-semibold border-b">Type</th>
                  <th className="px-6 py-4 font-semibold border-b text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {!data.cashTransactions || data.cashTransactions.length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-slate-500">No cash transactions found.</td></tr>
                ) : (
                  data.cashTransactions.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 text-sm text-slate-600">{format(new Date(c.date), "dd/MM/yyyy")}</td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-500">#{c.receiptNo}</td>
                      <td className="px-6 py-4 text-sm text-slate-800 flex items-center gap-2">
                        {c.type === "TAKEN" ? <ArrowDownCircle className="w-4 h-4 text-red-500" /> : <ArrowUpCircle className="w-4 h-4 text-green-500" />}
                        {c.type === "TAKEN" ? "Loan Taken" : "Repayment"}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-slate-800 text-right">Rs. {c.amount.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
}
