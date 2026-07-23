"use client";

import { CheckCircle2, XCircle } from "lucide-react";

interface AlertModalProps {
  isOpen: boolean;
  type: "success" | "error";
  title: string;
  message: string;
  onClose: () => void;
}

export function AlertModal({ isOpen, type, title, message, onClose }: AlertModalProps) {
  if (!isOpen) return null;

  const isSuccess = type === "success";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className={`p-6 flex flex-col items-center text-center ${isSuccess ? 'bg-green-50' : 'bg-red-50'}`}>
          {isSuccess ? (
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
          ) : (
            <XCircle className="w-16 h-16 text-red-500 mb-4" />
          )}
          <h2 className={`text-xl font-bold mb-2 ${isSuccess ? 'text-green-900' : 'text-red-900'}`}>
            {title}
          </h2>
          <p className="text-slate-600 whitespace-pre-line">
            {message}
          </p>
        </div>
        <div className="p-4 bg-white border-t border-slate-100">
          <button
            onClick={onClose}
            className={`w-full py-2.5 px-4 rounded-lg font-medium text-white transition-colors ${
              isSuccess 
                ? 'bg-green-600 hover:bg-green-700' 
                : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
