"use client";

import { useState, useRef } from "react";
import { Sprout, Search, Save, CheckCircle2, Plus, X } from "lucide-react";

export default function CropsLoggingPage() {
  const [farmerId, setFarmerId] = useState("");
  const [farmerInfo, setFarmerInfo] = useState<any>(null);
  
  const [cropType, setCropType] = useState("COTTON");
  const [cropPrice, setCropPrice] = useState("");
  const [bagWeights, setBagWeights] = useState<number[]>([]);
  const [customerBagWeights, setCustomerBagWeights] = useState<number[]>([]);
  const [currentWeight, setCurrentWeight] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [saveStatus, setSaveStatus] = useState("");
  const [customerOnly, setCustomerOnly] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSearchFarmer = async () => {
    if (!farmerId) return;
    setFarmerInfo(null);
    setError("");
    setBagWeights([]); // reset on new farmer
    setCustomerBagWeights([]);
    
    try {
      const res = await fetch(`/api/farmers/${farmerId.toUpperCase()}/history`);
      if (!res.ok) throw new Error("Farmer not found");
      const data = await res.json();
      setFarmerInfo(data);
    } catch (err: any) {
      setError(err.message);
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
          price: cropPrice
        }),
      });

      if (!res.ok) throw new Error("Failed to auto-save");
      setSaveStatus("Saved successfully!");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err: any) {
      setSaveStatus("Error saving!");
      console.error(err);
    }
  };

  const saveCustomerToDatabase = async (weightsToSave: number[]) => {
    if (!farmerInfo || !cropPrice) return;
    setSaveStatus("Saving...");
    
    try {
      const res = await fetch("/api/crops/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmerId: farmerInfo.id,
          cropType,
          bagWeights: weightsToSave,
          price: cropPrice
        }),
      });

      if (!res.ok) throw new Error("Failed to auto-save customer batch");
      setSaveStatus("Saved successfully!");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (err: any) {
      setSaveStatus("Error saving!");
      console.error(err);
    }
  };

  const handleAddWeight = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (!cropPrice || parseFloat(cropPrice) <= 0) {
      setError("Please enter a valid price for the crop first.");
      return;
    }

    const w = parseFloat(currentWeight);
    if (isNaN(w) || w <= 0) return;
    
    if (bagWeights.length + customerBagWeights.length >= 200) {
      setError("Maximum of 200 bags reached for this batch.");
      return;
    }

    const newWeights = (customerOnly ? [...customerBagWeights, w] : [...bagWeights, w]);
    if (customerOnly) {
      setCustomerBagWeights(newWeights);
      saveCustomerToDatabase(newWeights);
    } else {
      setBagWeights(newWeights);
      saveToDatabase(newWeights);
    }
    
    setCurrentWeight("");
    inputRef.current?.focus();
  };
  
  const handleRemoveWeight = (index: number, isCustomer: boolean = false) => {
    if (isCustomer) {
      const newWeights = customerBagWeights.filter((_, i) => i !== index);
      setCustomerBagWeights(newWeights);
      saveCustomerToDatabase(newWeights);
    } else {
      const newWeights = bagWeights.filter((_, i) => i !== index);
      setBagWeights(newWeights);
      saveToDatabase(newWeights);
    }
  };

  const totalWeight = bagWeights.reduce((a, b) => a + b, 0);
  const totalValue = totalWeight * (parseFloat(cropPrice) || 0);
  const customerTotalWeight = customerBagWeights.reduce((a, b) => a + b, 0);
  const customerTotalValue = customerTotalWeight * (parseFloat(cropPrice) || 0);

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col pt-8 pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-green-100 p-3 rounded-full">
          <Sprout className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">Cotton & Mirchi Logging</h1>
          <p className="text-slate-500">Record bag weights up to 200 bags with auto-save.</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}

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
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-green-500 uppercase"
                  placeholder="F-001"
                />
              </div>
              <button 
                onClick={handleSearchFarmer}
                className="bg-slate-800 text-white px-6 py-2 h-[42px] rounded-lg hover:bg-green-950 flex items-center gap-2"
              >
                <Search className="w-4 h-4" /> Fetch
              </button>
              <label className="flex items-center ml-4 text-sm text-slate-600">
                <input type="checkbox" checked={customerOnly} onChange={(e) => setCustomerOnly(e.target.checked)} className="mr-1" />
                Save for this farmer only
              </label>
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
              {/* STEP 2: Crop Type and Price */}
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <h3 className="font-semibold text-slate-800 mb-4">Step 2: Crop Details</h3>
                <div className="flex gap-4">
                  <div className="flex-1 space-y-2">
                    <label className="text-sm text-slate-600">Crop Type</label>
                    <div className="flex gap-2">
                      <label className={`flex-1 flex justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        cropType === "COTTON" ? "border-slate-800 bg-slate-800 text-white" : "border-slate-200 bg-white text-slate-600"
                      }`}>
                        <input type="radio" className="hidden" checked={cropType === "COTTON"} onChange={() => setCropType("COTTON")} />
                        Cotton
                      </label>
                      <label className={`flex-1 flex justify-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                        cropType === "MIRCHI" ? "border-red-600 bg-red-600 text-white" : "border-slate-200 bg-white text-slate-600"
                      }`}>
                        <input type="radio" className="hidden" checked={cropType === "MIRCHI"} onChange={() => setCropType("MIRCHI")} />
                        Mirchi
                      </label>
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-sm text-slate-600">Price (per kg)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={cropPrice}
                      onChange={(e) => setCropPrice(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-green-500"
                      placeholder="e.g. 70"
                    />
                  </div>
                </div>
              </div>

              {/* STEP 3: Bag Weights */}
              <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-slate-800">Step 3: Enter Bag Weights</h3>
                  <div className="text-sm font-medium text-slate-500">
                    Bags: <span className="text-green-950">{(bagWeights.length + customerBagWeights.length)}/200</span>
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
                    disabled={(bagWeights.length + customerBagWeights.length) >= 200 || !cropPrice}
                  />
                  <button 
                    type="submit"
                    disabled={(bagWeights.length + customerBagWeights.length) >= 200 || !currentWeight || !cropPrice}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 rounded-lg flex items-center gap-2 disabled:opacity-50"
                  >
                    <Plus className="w-5 h-5"/> Add Bag
                  </button>
                </form>

                {saveStatus && (
                  <div className="text-sm text-green-600 flex items-center gap-1 mb-4 animate-pulse">
                    <CheckCircle2 className="w-4 h-4" /> {saveStatus}
                  </div>
                )}

                {bagWeights.length > 0 && (
                  <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
                    <div className="grid grid-cols-5 md:grid-cols-10 gap-px bg-slate-200">
                      {bagWeights.map((w, idx) => (
                        <div key={idx} className="bg-white p-2 text-center group relative border-b border-r border-slate-100">
                          <span className="text-xs text-slate-400 block mb-1">#{idx + 1}</span>
                          <span className="font-semibold text-slate-700">{w}</span>
                          <button 
                            onClick={() => handleRemoveWeight(idx, false)}
                            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                            title="Remove"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="bg-slate-100 p-4 flex flex-col md:flex-row justify-between items-center gap-2">
                      <span className="font-medium text-slate-600">Total Bags: {bagWeights.length}</span>
                      <span className="font-semibold text-slate-700">Total Weight: {totalWeight.toFixed(2)} kg</span>
                      <span className="text-xl font-bold text-green-950">Total Value: ₹{totalValue.toFixed(2)}</span>
                    </div>
                  </div>
                )}
                {customerBagWeights.length > 0 && (
                   <div className="mt-4 border border-indigo-200 rounded-lg bg-indigo-50 overflow-hidden">
                     <div className="grid grid-cols-5 md:grid-cols-10 gap-px bg-indigo-200">
                       {customerBagWeights.map((w, idx) => (
                         <div key={idx} className="bg-white p-2 text-center group relative border-b border-r border-indigo-100">
                           <span className="text-xs text-indigo-400 block mb-1">#{idx + 1}</span>
                           <span className="font-semibold text-indigo-700">{w}</span>
                           <button 
                             onClick={() => handleRemoveWeight(idx, true)}
                             className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-700"
                             title="Remove"
                           >
                             <X className="w-3 h-3" />
                           </button>
                         </div>
                       ))}
                     </div>
                     <div className="bg-indigo-100 p-4 flex flex-col md:flex-row justify-between items-center gap-2">
                       <span className="font-medium text-indigo-600">Customer Bags: {customerBagWeights.length}</span>
                       <span className="font-semibold text-indigo-700">Weight: {customerTotalWeight.toFixed(2)} kg</span>
                       <span className="text-xl font-bold text-indigo-950">Value: ₹{customerTotalValue.toFixed(2)}</span>
                     </div>
                   </div>
                 )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
