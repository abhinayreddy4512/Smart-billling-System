"use client";

import { useState, useRef, useEffect } from "react";
import { Receipt, Camera, Check, X, Search, ShoppingCart, Plus, Trash2 } from "lucide-react";
import Webcam from "react-webcam";

type CartItem = {
  productId: string;
  name: string;
  category: string;
  size: string | null;
  quantity: string;
  customPrice: string;
  total: number;
};

export default function BillingPage() {
  const [farmerId, setFarmerId] = useState("");
  const [farmerInfo, setFarmerInfo] = useState<any>(null);
  
  const [products, setProducts] = useState<any[]>([]);
  
  // Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  
  // Current item state
  const [selectedProductId, setSelectedProductId] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [price, setPrice] = useState("");
  
  const [photo, setPhoto] = useState<string | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  const webcamRef = useRef<Webcam>(null);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchStock = () => {
    fetch("/api/stock")
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(err => console.error("Error fetching stock:", err));
  };

  useEffect(() => {
    fetchStock();
  }, []);

  const handleSearchFarmer = async () => {
    if (!farmerId) return;
    setFarmerInfo(null);
    setError("");
    
    try {
      const res = await fetch(`/api/farmers/${farmerId.toUpperCase()}/history`);
      if (!res.ok) throw new Error("Farmer not found");
      const data = await res.json();
      setFarmerInfo(data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleProductSelect = (id: string) => {
    setSelectedProductId(id);
    const prod = products.find(p => p.id === id);
    if (prod) {
      setPrice(prod.price.toString());
    }
  };

  const addToCart = () => {
    const prod = products.find(p => p.id === selectedProductId);
    if (!prod) return;

    const qty = parseInt(quantity, 10);
    const prc = parseFloat(price);

    if (isNaN(qty) || qty <= 0) {
      setError("Please enter a valid quantity.");
      return;
    }
    
    if (qty > prod.quantity) {
      setError(`Only ${prod.quantity} items left in stock for ${prod.name}.`);
      return;
    }
    
    setError("");

    const newItem: CartItem = {
      productId: prod.id,
      name: prod.name,
      category: prod.category,
      size: prod.size,
      quantity: quantity,
      customPrice: price,
      total: qty * prc
    };

    setCart([...cart, newItem]);
    
    // Reset inputs
    setSelectedProductId("");
    setQuantity("1");
    setPrice("");
  };

  const removeFromCart = (index: number) => {
    const newCart = [...cart];
    newCart.splice(index, 1);
    setCart(newCart);
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
    if (!farmerInfo || cart.length === 0 || !photo) {
      setError("Please select a farmer, add items to cart, and capture a photo proof.");
      return;
    }
    
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farmerId: farmerInfo.id,
          photoProof: photo,
          items: cart.map(item => ({
            productId: item.productId,
            quantity: item.quantity,
            customPrice: item.customPrice
          }))
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Billing failed");
      }

      setSuccess("Bill generated successfully for all items!");
      
      // Reset form
      setCart([]);
      setPhoto(null);
      fetchStock();
        
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const cartTotal = cart.reduce((sum, item) => sum + item.total, 0);

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col pt-8 pb-12">
      <div className="flex items-center gap-3 mb-8">
        <div className="bg-green-100 p-3 rounded-full">
          <Receipt className="w-6 h-6 text-green-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-green-950">Billing Counter</h1>
          <p className="text-slate-500">Add multiple products to cart and generate a unified bill.</p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
        {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}
        {success && <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg font-medium">{success}</div>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* LEFT COLUMN: Data Entry */}
          <div className="space-y-6">
            {/* STEP 1: Farmer Selection */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">1. Select Farmer</h3>
              <div className="flex gap-4 items-end">
                <div className="flex-1 space-y-2">
                  <label className="text-sm text-slate-600">Farmer ID</label>
                  <input
                    type="text"
                    value={farmerId}
                    onChange={(e) => setFarmerId(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-green-600 uppercase"
                    placeholder="F-001"
                  />
                </div>
                <button 
                  onClick={handleSearchFarmer}
                  className="bg-green-800 text-white px-6 py-2 h-[42px] rounded-lg hover:bg-green-900 flex items-center gap-2"
                >
                  <Search className="w-4 h-4" /> Fetch
                </button>
              </div>
              {farmerInfo && (
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-900 flex justify-between items-center">
                  <span><strong>Name:</strong> {farmerInfo.name}</span>
                  <span><strong>Phone:</strong> {farmerInfo.phone}</span>
                </div>
              )}
            </div>

            {/* STEP 2: Add Products */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">2. Add to Cart</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-slate-600">Select Product</label>
                  <select 
                    value={selectedProductId} 
                    onChange={(e) => handleProductSelect(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-green-600"
                  >
                    <option value="">-- Choose Product --</option>
                    {products.filter(p => p.quantity > 0).map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.size ? `(${p.size})` : ''} - {p.quantity} items left
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600">No. of Items</label>
                    <input
                      type="number"
                      min="1"
                      max={selectedProduct?.quantity || 1}
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-green-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm text-slate-600">Unit Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-green-600"
                    />
                  </div>
                </div>
                
                <button
                  onClick={addToCart}
                  disabled={!selectedProductId}
                  className="w-full bg-slate-800 hover:bg-green-950 text-white px-4 py-3 rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Plus className="w-4 h-4"/> Add to Bill
                </button>
              </div>
            </div>

            {/* STEP 3: Photo Proof */}
            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200">
              <h3 className="font-semibold text-slate-800 mb-4">3. Photo Proof</h3>
              
              {!photo && !showCamera && (
                <button 
                  onClick={() => setShowCamera(true)}
                  className="w-full py-6 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center gap-2 text-slate-500 hover:bg-slate-100 hover:text-green-700 transition-colors"
                >
                  <Camera className="w-6 h-6" />
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
                    className="rounded-lg w-full max-w-sm"
                  />
                  <div className="flex gap-4">
                    <button onClick={capturePhoto} className="bg-green-600 text-white px-6 py-2 rounded-full font-medium hover:bg-green-700">Capture</button>
                    <button onClick={() => setShowCamera(false)} className="bg-slate-700 text-white px-6 py-2 rounded-full font-medium hover:bg-slate-600">Cancel</button>
                  </div>
                </div>
              )}

              {photo && (
                <div className="flex flex-col items-center gap-2">
                  <img src={photo} alt="Proof" className="rounded-lg border border-slate-300 shadow-sm w-full max-w-xs" />
                  <button onClick={() => setPhoto(null)} className="flex items-center gap-1 text-red-600 font-medium hover:underline text-sm">
                    <X className="w-4 h-4"/> Retake
                  </button>
                </div>
              )}
            </div>

          </div>

          {/* RIGHT COLUMN: Cart View */}
          <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 flex flex-col">
            <div className="flex items-center gap-2 mb-6">
              <ShoppingCart className="w-5 h-5 text-slate-700" />
              <h3 className="font-semibold text-slate-800 text-lg">Current Bill (Cart)</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto mb-6 bg-white border border-slate-200 rounded-lg p-2">
              {cart.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                  <ShoppingCart className="w-12 h-12 mb-2 opacity-20" />
                  <p>No items added yet</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {cart.map((item, idx) => (
                    <li key={idx} className="p-3 flex justify-between items-center group hover:bg-slate-50 rounded">
                      <div>
                        <div className="font-medium text-slate-800">
                          {item.name} {item.size && <span className="text-slate-500 text-sm">({item.size})</span>}
                        </div>
                        <div className="text-sm text-slate-500">
                          {item.quantity} x ₹{item.customPrice}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="font-bold text-slate-700">₹{item.total.toFixed(2)}</div>
                        <button onClick={() => removeFromCart(idx)} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-slate-200 pt-4 mb-6 flex justify-between items-center">
              <span className="text-lg font-medium text-slate-700">Total Amount:</span>
              <span className="text-3xl font-bold text-green-950">₹{cartTotal.toFixed(2)}</span>
            </div>

            <button
              onClick={handleSubmit}
              disabled={loading || !farmerInfo || cart.length === 0 || !photo}
              className="w-full bg-green-700 hover:bg-green-800 text-white px-6 py-4 rounded-xl font-bold text-lg transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? "Processing..." : <><Check className="w-5 h-5"/> Checkout Cart</>}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
