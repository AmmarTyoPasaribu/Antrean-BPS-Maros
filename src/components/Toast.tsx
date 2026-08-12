'use client';

import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, X } from 'lucide-react';

export interface ToastState {
  type: 'success' | 'error';
  message: string;
}

interface ToastProps {
  toast: ToastState | null;
  onClose: () => void;
}

export default function Toast({ toast, onClose }: ToastProps) {
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';

  return createPortal(
    <div
      id="toast-notification"
      className={`fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-xl border animate-fadeIn max-w-sm ${
        isSuccess ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-700'
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
      ) : (
        <XCircle className="w-4 h-4 shrink-0 text-red-500" />
      )}
      <span className="text-xs font-semibold leading-snug">{toast.message}</span>
      <button
        type="button"
        onClick={onClose}
        className="ml-1 text-current opacity-50 hover:opacity-100 transition cursor-pointer shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>,
    document.body
  );
}
