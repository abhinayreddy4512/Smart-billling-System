"use client";

import { useState, useRef } from "react";
import { Banknote, Camera, Check, X, Search, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import Webcam from "react-webcam";
import { AlertModal } from "@/components/ui/AlertModal";

export default function CashSectionPage() {
  const [farmerId, setFarmerId] = useState("");
  const [farmerInfo, setFarmerInfo] = useState<any>(null);
  
  const [transactionType, setTransactionType] = useState("TAKEN");
  const [amount, setAmount] = useState("");
  
  const [photo, setPhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  
  const [loading, setLoading] = useState(false);
  
  // Alert Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"success" | "error">("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");

  const handleSearchFarmer = async () => {
    if (!farmerId) return;
    setFarmerInfo(null);
    
    
    try {
      const res = await fetch(`/api/farmers/${farmerId.toUpperCase()}/history`);
      if (!res.ok) throw new Error("Farmer not found");
      const data = await res.json();
      setFarmerInfo(data);
    } catch (err: any) {
      setModalType("error");
      setModalTitle("Search Unsuccessful");
      setModalMessage(err.message);
      setModalOpen(true);
    }
  };

  const capturePhoto = () => {
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      setPhoto(imageSrc);
      setShowCamera(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!farmerInfo || !amount || !photo) {
      setModalType("error");
      setModalTitle("Missing Information");
      setModalMessage("Please complete all fields and capture a photo for proof.");
      setModalOpen(true);
      return;
    }
    
    setLoading(true);

    try {
      const res = await fetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmerId: farmerInfo.id,
          type: transactionType,
          amount,
          photoProof: photo
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Transaction failed");
      }

      const data = await res.json();
      
      setModalType("success");
      setModalTitle("Entry Successful");
      setModalMessage(`Cash ${transactionType.toLowerCase()} transaction recorded successfully!\nReceipt ID: ${data.receiptNo || "-"}`);
      setModalOpen(true);
      
      // Reset form partially
      setAmount("");
      setPhoto(null);
        
    } catch (err: any) {
      setModalType("error");
      setModalTitle("Entry Unsuccessful");
      setModalMessage(err.message);
      setModalOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col pt-8 pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-emerald-100 p-3 rounded-full">
          <Banknote className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">Cash Section</h1>
          <p className="text-slate-500">Record cash taken by or given by farmers with photo proof.</p>
        </div>
      </div>

      <AlertModal
        isOpen={modalOpen}
        type={modalType}
        title={modalTitle}
        message={modalMessage}
        onClose={() => setModalOpen(false)}
      />

      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">

        <div className="space-y-8">
          {/* STEP 1: Farmer Selection */}
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4">Step 1: Select Farmer</h3>
            <div className="flex gap-4 items-end">
              <div className="flex-1 space-y-2">
                <label className="text-sm text-slate-600">Farmer ID</label>
                <input
                  type="text"
                  value={farmerId}
                  onChange={(e) => setFarmerId(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 uppercase"
                  placeholder="F-001"
                />
              </div>
              <button 
                onClick={handleSearchFarmer}
                className="bg-slate-800 text-white px-6 py-2 h-[42px] rounded-lg hover:bg-green-950 flex items-center gap-2"
              >
                <Search className="w-4 h-4" /> Fetch
              </button>
            </div>
            {farmerInfo && (
              <div className="mt-4 p-3 bg-green-50 border border-blue-200 rounded-lg text-sm text-blue-900 flex justify-between items-center">
                <span><strong>Name:</strong> {farmerInfo.name}</span>
                <span><strong>Phone:</strong> {farmerInfo.phone}</span>
              </div>
            )}
          </div>

          {/* STEP 2: Transaction Details */}
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4">Step 2: Transaction Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <label className="text-sm text-slate-600">Transaction Type</label>
                <div className="flex gap-4">
                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    transactionType === "TAKEN" ? "border-red-500 bg-red-50 text-red-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}>
                    <input type="radio" name="type" className="hidden" checked={transactionType === "TAKEN"} onChange={() => setTransactionType("TAKEN")} />
                    <ArrowDownCircle className="w-5 h-5" /> Taken by Farmer
                  </label>
                  
                  <label className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                    transactionType === "GIVEN" ? "border-green-500 bg-green-50 text-green-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}>
                    <input type="radio" name="type" className="hidden" checked={transactionType === "GIVEN"} onChange={() => setTransactionType("GIVEN")} />
                    <ArrowUpCircle className="w-5 h-5" /> Given by Farmer
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-slate-600">Amount (₹)</label>
                <input
                  type="text"
                  value={amount}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || /^\d*\.?\d*$/.test(val)) {
                      setAmount(val);
                    }
                  }}
                  placeholder="e.g. 5000"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 text-xl font-medium h-[52px]"
                />
              </div>
            </div>
          </div>

          {/* STEP 3: Photo Proof */}
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4">Step 3: Capture Photo Proof</h3>
            
            {!photo && !showCamera && (
              <button 
                onClick={() => setShowCamera(true)}
                className="w-full py-8 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 transition-colors"
              >
                <Camera className="w-8 h-8" />
                <span>Open Camera</span>
              </button>
            )}

            {showCamera && (
              <div className="flex flex-col items-center gap-4 bg-black p-4 rounded-lg">
                <Webcam
                  audio={false}
                  ref={webcamRef}
                  screenshotFormat="image/jpeg"
                  videoConstraints={{ facingMode: "user" }}
                  className="rounded-lg w-full max-w-md"
                />
                <div className="flex gap-4">
                  <button onClick={capturePhoto} className="bg-green-600 text-white px-6 py-2 rounded-full font-medium hover:bg-green-700 flex items-center gap-2">
                    <Camera className="w-4 h-4"/> Capture
                  </button>
                  <button onClick={() => setShowCamera(false)} className="bg-slate-700 text-white px-6 py-2 rounded-full font-medium hover:bg-slate-600">
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {photo && (
              <div className="flex flex-col items-center gap-4">
                <img src={photo} alt="Customer Proof" className="rounded-lg border border-slate-300 shadow-sm w-full max-w-md" />
                <button onClick={() => setPhoto(null)} className="flex items-center gap-2 text-red-600 font-medium hover:underline">
                  <X className="w-4 h-4"/> Retake Photo
                </button>
              </div>
            )}
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={loading || !farmerInfo || !amount || !photo}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? "Processing..." : <><Check className="w-5 h-5"/> Record Transaction</>}
          </button>
        </div>
      </div>
    </div>
  );
}
