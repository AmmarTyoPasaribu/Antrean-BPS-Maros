'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, HelpCircle } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  isProcessing?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Ya, Lanjutkan',
  cancelLabel = 'Batal',
  variant = 'default',
  isProcessing = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  const isDanger = variant === 'danger';

  // Portal ke document.body: menjamin backdrop selalu menutupi seluruh
  // viewport apapun yang terjadi, tanpa bergantung pada struktur/CSS
  // ancestor di tempat modal ini dipanggil.
  return createPortal(
    <div
      id="confirm-modal-backdrop"
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[70] animate-fadeIn"
    >
      <div className="bg-surface rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-slate-100 relative">
        <div className="flex flex-col items-center text-center mb-6">
          <div className={`p-3 rounded-2xl mb-3 ${isDanger ? 'bg-red-50 text-red-600' : 'bg-sky-50 text-sky-600'}`}>
            {isDanger ? <AlertTriangle className="w-6 h-6" /> : <HelpCircle className="w-6 h-6" />}
          </div>
          <h3 className="font-bold font-display text-lg text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500 mt-2 leading-relaxed">{message}</p>
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            id="confirm-modal-cancel-btn"
            onClick={onCancel}
            disabled={isProcessing}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition duration-150 text-xs cursor-pointer disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            id="confirm-modal-confirm-btn"
            onClick={onConfirm}
            disabled={isProcessing}
            className={`flex-1 text-white font-bold py-3 rounded-xl shadow-lg transition duration-150 text-xs cursor-pointer disabled:opacity-70 ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                : 'bg-sky-600 hover:bg-sky-700 shadow-sky-600/20'
            }`}
          >
            {isProcessing ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
