"use client";

import React, { useState, useRef } from "react";
import { Sprout, Search, Save, CheckCircle2, Plus, X, List, HandCoins } from "lucide-react";
import SettlementSection from "./SettlementSection";
import { AlertModal } from "@/components/ui/AlertModal";

export default function CropsLoggingPage() {
  const [activeTab, setActiveTab] = useState<"ENTRY" | "SETTLEMENT">("ENTRY");
  
  // ENTRY TAB STATE
  const [farmerId, setFarmerId] = useState("");
  const [farmerInfo, setFarmerInfo] = useState<any>(null);
  
  // SETTLEMENT TAB STATE
  const [settlementSearchInput, setSettlementSearchInput] = useState("");
  const [settlementFarmerId, setSettlementFarmerId] = useState("");
  
  const [cropType, setCropType] = useState("COTTON");
  const [cropPrice, setCropPrice] = useState(""); // Price per 100kg
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [bagWeights, setBagWeights] = useState<number[]>([]);
  const [currentWeight, setCurrentWeight] = useState("");
  
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  
  // Alert Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"success" | "error">("success");
  const [modalTitle, setModalTitle] = useState("");
  const [modalMessage, setModalMessage] = useState("");
  
  const inputRef = useRef<HTMLInputElement>(null);

  // For searching farmer
  const handleSearchFarmer = async () => {
    if (!farmerId) return;
    setFarmerInfo(null);
    
    setBagWeights([]); 
    
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

  const saveToDatabase = async (weightsToSave: number[]) => {
    if (!farmerInfo || !cropPrice) return;
    setSaveStatus("Saving...");
    
    try {
      const res = await fetch("/api/crops", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmerId: farmerInfo.id,
          cropType,
          bagWeights: weightsToSave,
          price: cropPrice, // Storing price per 100kg
          date: entryDate
        }),
      });

      if (!res.ok) throw new Error("Failed to save entry");
      
      const newLog = await res.json();
      setModalType("success");
      setModalTitle("Entry Successful");
      setModalMessage(`Crop log saved successfully!\nLog ID: ${newLog.logNo || "-"}`);
      setModalOpen(true);
      
      setSaveStatus("Saved successfully!");
      setBagWeights([]); // Reset form after saving
      setCropPrice("");
      setTimeout(() => setSaveStatus(""), 3000);
    } catch (err: any) {
      setModalType("error");
      setModalTitle("Entry Unsuccessful");
      setModalMessage(err.message);
      setModalOpen(true);
      
      setSaveStatus("Error saving!");
      console.error(err);
    }
  };

  const handleAddWeight = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!cropPrice || parseFloat(cropPrice) <= 0) {
      setError("Please enter a valid price for 100kg first.");
      return;
    }

    const w = parseFloat(currentWeight);
    if (isNaN(w) || w <= 0) return;
    
    if (bagWeights.length >= 200) {
      setError("Maximum of 200 bags reached for this batch.");
      return;
    }

    const newWeights = [...bagWeights, w];
    setBagWeights(newWeights);
    
    setCurrentWeight("");
    inputRef.current?.focus();
  };
  
  const handleRemoveWeight = (index: number) => {
    const newWeights = bagWeights.filter((_, i) => i !== index);
    setBagWeights(newWeights);
  };

  const totalWeight = bagWeights.reduce((a, b) => a + b, 0);
  const pricePer100kg = parseFloat(cropPrice) || 0;
  // Calculate value based on per 100kg price
  const totalValue = (totalWeight / 100) * pricePer100kg;

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col pt-8 pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-green-100 p-3 rounded-full">
          <Sprout className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">Cotton & Mirchi</h1>
          <p className="text-slate-500">Log new crop weights or settle outstanding balances.</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-8">
        <button
          onClick={() => setActiveTab("ENTRY")}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "ENTRY" 
              ? "border-green-600 text-green-700 bg-green-50/50" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <List className="w-4 h-4" /> Log New Crop
        </button>
        <button
          onClick={() => setActiveTab("SETTLEMENT")}
          className={`flex items-center gap-2 px-6 py-3 font-medium text-sm transition-colors border-b-2 ${
            activeTab === "SETTLEMENT" 
              ? "border-emerald-600 text-emerald-700 bg-emerald-50/50" 
              : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50"
          }`}
        >
          <HandCoins className="w-4 h-4" /> Settlement
        </button>
      </div>

      {activeTab === "ENTRY" && (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
          <AlertModal
            isOpen={modalOpen}
            type={modalType}
            title={modalTitle}
            message={modalMessage}
            onClose={() => setModalOpen(false)}
          />

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
                    onBlur={handleSearchFarmer}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchFarmer()}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-green-500 uppercase"
                    placeholder="F-001"
                  />
                </div>
                <button 
                  onClick={handleSearchFarmer}
                  className="bg-slate-800 text-white px-6 py-2 h-[42px] rounded-lg hover:bg-slate-900 transition-colors"
                >
                  <Search className="w-4 h-4 inline-block mr-2"/>
                  Search
                </button>
              </div>
              {farmerInfo && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900 flex justify-between items-center">
                  <span><strong>Name:</strong> {farmerInfo.name}</span>
                  <span><strong>Phone:</strong> {farmerInfo.phone}</span>
                </div>
              )}
            </div>

            {farmerInfo && (
              <>
                {/* STEP 2: Crop Type, Price, and Date */}
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <h3 className="font-semibold text-slate-800 mb-4">Step 2: Crop Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600">Crop Type</label>
                      <div className="flex gap-2">
                        <label className={`flex-1 flex justify-center items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${
                          cropType === "COTTON" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600"
                        }`}>
                          <input type="radio" className="hidden" checked={cropType === "COTTON"} onChange={() => setCropType("COTTON")} />
                          Cotton
                        </label>
                        <label className={`flex-1 flex justify-center items-center gap-2 p-2 rounded-lg border-2 cursor-pointer transition-all ${
                          cropType === "MIRCHI" ? "border-red-600 bg-red-600 text-white" : "border-slate-200 bg-white text-slate-600"
                        }`}>
                          <input type="radio" className="hidden" checked={cropType === "MIRCHI"} onChange={() => setCropType("MIRCHI")} />
                          Mirchi
                        </label>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600">Price (per 100kg)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={cropPrice}
                        onChange={(e) => setCropPrice(e.target.value)}
                        className="w-full px-4 py-2 h-[44px] border border-slate-300 rounded-lg focus:ring-green-500"
                        placeholder="e.g. 7000"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-600">Date of Entry</label>
                      <input
                        type="date"
                        value={entryDate}
                        onChange={(e) => setEntryDate(e.target.value)}
                        className="w-full px-4 py-2 h-[44px] border border-slate-300 rounded-lg focus:ring-green-500"
                      />
                    </div>
                  </div>
                </div>

                {/* STEP 3: Bag Weights */}
                <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="font-semibold text-slate-800">Step 3: Enter Bag Weights</h3>
                    <div className="text-sm font-medium text-slate-500">
                      Bags: <span className="text-green-950 font-bold">{bagWeights.length}</span> (up to 200)
                    </div>
                  </div>

                  <form onSubmit={handleAddWeight} className="flex gap-4 mb-6">
                    <input
                      ref={inputRef}
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={currentWeight}
                      onChange={(e) => setCurrentWeight(e.target.value)}
                      placeholder="Enter weight in kg and press Enter"
                      className="flex-1 px-4 py-3 border border-slate-300 rounded-lg focus:ring-green-500 text-lg"
                      disabled={bagWeights.length >= 200 || !cropPrice}
                    />
                    <button 
                      type="submit"
                      disabled={bagWeights.length >= 200 || !currentWeight || !cropPrice}
                      className="bg-green-600 hover:bg-green-700 text-white px-6 rounded-lg flex items-center gap-2 disabled:opacity-50 font-medium"
                    >
                      <Plus className="w-5 h-5"/> Add Bag
                    </button>
                  </form>

                  {saveStatus && (
                    <div className="text-sm text-green-600 flex items-center gap-1 mb-4 animate-pulse font-medium">
                      <CheckCircle2 className="w-4 h-4" /> {saveStatus}
                    </div>
                  )}

                  {bagWeights.length > 0 && (
                    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden shadow-sm">
                      <div className="grid grid-cols-5 md:grid-cols-10 gap-px bg-slate-200">
                        {bagWeights.map((w, idx) => (
                          <div key={idx} className="bg-white p-2 text-center group relative border-b border-r border-slate-100 hover:bg-slate-50 transition-colors">
                            <span className="text-xs text-slate-400 block mb-1">#{idx + 1}</span>
                            <span className="font-semibold text-slate-700">{w}</span>
                            <button 
                              onClick={() => handleRemoveWeight(idx)}
                              className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700 transition-opacity"
                              title="Remove"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <div className="bg-slate-100 p-5 flex flex-col md:flex-row justify-between items-center gap-4 border-t border-slate-200">
                        <div className="flex gap-4">
                          <span className="font-medium text-slate-600">Total Bags: <span className="text-slate-800 font-bold">{bagWeights.length}</span></span>
                          <span className="font-medium text-slate-600">Total Weight: <span className="text-slate-800 font-bold">{totalWeight.toFixed(2)} kg</span></span>
                        </div>
                        <span className="text-xl font-bold text-green-950">Total Value: ₹{totalValue.toFixed(2)}</span>
                        <button 
                          onClick={() => saveToDatabase(bagWeights)}
                          className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-colors flex items-center gap-2"
                        >
                          <Save className="w-4 h-4" /> Save Entry
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "SETTLEMENT" && (
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-slate-800 mb-2">View & Settle Accounts</h2>
            <p className="text-slate-500 text-sm">Enter a Farmer ID to view their full crop sales history and record a settlement payment.</p>
          </div>
          
          <div className="max-w-md flex gap-4 items-end mb-6">
            <div className="flex-1 space-y-2">
              <label className="text-sm text-slate-600 font-medium">Farmer ID</label>
              <input
                type="text"
                value={settlementSearchInput}
                onChange={(e) => setSettlementSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && setSettlementFarmerId(settlementSearchInput.toUpperCase())}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-emerald-500 uppercase"
                placeholder="F-001"
              />
            </div>
            <button 
              onClick={() => setSettlementFarmerId(settlementSearchInput.toUpperCase())}
              className="bg-emerald-600 text-white px-6 py-2 h-[42px] rounded-lg hover:bg-emerald-700 transition-colors font-medium shadow-sm"
            >
              Search
            </button>
          </div>

          {settlementFarmerId ? (
            <div className="border-t border-slate-100 -mx-8 px-8 pt-6 mt-6">
              <SettlementSection farmerId={settlementFarmerId} />
            </div>
          ) : (
            <div className="text-center py-12 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 text-slate-500 mt-6">
              Enter a Farmer ID above to load their settlement data.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
