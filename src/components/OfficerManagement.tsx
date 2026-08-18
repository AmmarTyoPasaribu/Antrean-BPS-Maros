'use client';

import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Officer, ActionResult } from '@/lib/types';
import { resolveOfficerImage } from '@/lib/ui';
import Toast, { type ToastState } from './Toast';
import ConfirmModal from './ConfirmModal';
import { UserPlus, ImageUp, Ban, CheckCircle2, Trash2, X, Users } from 'lucide-react';

interface OfficerManagementProps {
  officers: Officer[];
  onAddOfficer: (name: string) => Promise<ActionResult>;
  onUploadOfficerPhoto: (officerId: string, file: File) => Promise<ActionResult>;
  onToggleOfficerActive: (officerId: string, isActive: boolean) => Promise<ActionResult>;
  onDeleteOfficer: (officerId: string) => Promise<ActionResult>;
}

type PendingAction =
  | { type: 'add'; name: string }
  | { type: 'deactivate'; officer: Officer }
  | { type: 'delete'; officer: Officer };

export default function OfficerManagement({
  officers,
  onAddOfficer,
  onUploadOfficerPhoto,
  onToggleOfficerActive,
  onDeleteOfficer,
}: OfficerManagementProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOfficerName, setNewOfficerName] = useState('');
  const [uploadingOfficerId, setUploadingOfficerId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Form Tambah Petugas hanya menampung input di sini — konfirmasi
  // sesungguhnya (dan pemanggilan API) terjadi lewat ConfirmModal di bawah.
  const handleAddOfficerFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newOfficerName.trim();
    if (!name) return;
    setShowAddModal(false);
    setPendingAction({ type: 'add', name });
  };

  const handlePhotoChange = async (officer: Officer, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingOfficerId(officer.id);
    try {
      const result = await onUploadOfficerPhoto(officer.id, file);
      if (result.ok) {
        setToast({ type: 'success', message: `Foto ${officer.name} berhasil diperbarui.` });
      } else {
        setToast({ type: 'error', message: result.error || 'Gagal mengunggah foto.' });
      }
    } finally {
      setUploadingOfficerId(null);
    }
  };

  // Aktifkan tidak perlu konfirmasi (aman/reversibel). Nonaktifkan & hapus
  // lewat modal konfirmasi di bawah.
  const handleToggleClick = (officer: Officer) => {
    if (officer.is_active) {
      setPendingAction({ type: 'deactivate', officer });
    } else {
      onToggleOfficerActive(officer.id, true).then((result) => {
        if (result.ok) {
          setToast({ type: 'success', message: `${officer.name} berhasil diaktifkan.` });
        } else {
          setToast({ type: 'error', message: result.error || 'Gagal mengaktifkan petugas.' });
        }
      });
    }
  };

  const handleDeleteClick = (officer: Officer) => {
    setPendingAction({ type: 'delete', officer });
  };

  const handleConfirm = async () => {
    if (!pendingAction) return;
    setIsProcessingAction(true);
    try {
      if (pendingAction.type === 'add') {
        const result = await onAddOfficer(pendingAction.name);
        if (result.ok) {
          setNewOfficerName('');
          setToast({ type: 'success', message: `Petugas "${pendingAction.name}" berhasil ditambahkan.` });
        } else {
          setToast({ type: 'error', message: result.error || 'Gagal menambahkan petugas.' });
        }
      } else if (pendingAction.type === 'deactivate') {
        const result = await onToggleOfficerActive(pendingAction.officer.id, false);
        if (result.ok) {
          setToast({ type: 'success', message: `${pendingAction.officer.name} berhasil dinonaktifkan.` });
        } else {
          setToast({ type: 'error', message: result.error || 'Gagal menonaktifkan petugas.' });
        }
      } else if (pendingAction.type === 'delete') {
        const result = await onDeleteOfficer(pendingAction.officer.id);
        if (result.ok) {
          setToast({ type: 'success', message: `Petugas "${pendingAction.officer.name}" berhasil dihapus.` });
        } else {
          setToast({ type: 'error', message: result.error || 'Gagal menghapus petugas.' });
        }
      }
    } finally {
      setIsProcessingAction(false);
      setPendingAction(null);
    }
  };

  const confirmModalProps = (() => {
    if (!pendingAction) return null;
    if (pendingAction.type === 'add') {
      return {
        title: 'Tambah Petugas Baru?',
        message: `Anda yakin ingin menambahkan "${pendingAction.name}" sebagai petugas baru?`,
        confirmLabel: 'Ya, Tambahkan',
        variant: 'default' as const,
      };
    }
    if (pendingAction.type === 'deactivate') {
      return {
        title: 'Nonaktifkan Petugas?',
        message: `"${pendingAction.officer.name}" akan dinonaktifkan dan tidak akan jadi kandidat rotasi otomatis lagi. Bisa diaktifkan kembali kapan saja.`,
        confirmLabel: 'Ya, Nonaktifkan',
        variant: 'default' as const,
      };
    }
    return {
      title: 'Hapus Petugas Permanen?',
      message: `Anda yakin ingin menghapus "${pendingAction.officer.name}" secara permanen? Tindakan ini tidak bisa dibatalkan. Kalau petugas ini masih ada di daftar rotasi loket manapun, penghapusan akan ditolak sistem.`,
      confirmLabel: 'Ya, Hapus',
      variant: 'danger' as const,
    };
  })();

  return (
    <div id="officer-management-container" className="space-y-6">
      <div className="bg-surface rounded-3xl border border-slate-100 shadow-sm p-5 glow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold font-display text-slate-800 text-sm">Kelola Petugas</h3>
              <span className="text-[10px] font-medium text-slate-400">{officers.length} total petugas</span>
            </div>
          </div>
          <button
            id="open-add-officer-modal-btn"
            onClick={() => setShowAddModal(true)}
            className="bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white font-bold px-4 py-2.5 rounded-xl shadow-md shadow-sky-600/10 transition text-xs flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Tambah Petugas
          </button>
        </div>

        {/* Daftar petugas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pt-1">
          {officers.map((off) => (
            <div
              key={off.id}
              className={`flex items-center gap-3 p-3 rounded-2xl border ${
                off.is_active ? 'bg-slate-50 border-slate-100' : 'bg-slate-50/50 border-slate-100 opacity-60'
              }`}
            >
              <div className="relative shrink-0">
                <img
                  src={resolveOfficerImage(off.photo_url)}
                  alt={off.name}
                  className="w-11 h-11 rounded-xl object-cover border border-slate-200"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className="flex-grow min-w-0">
                <p className="text-xs font-bold text-slate-800 truncate">{off.name}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRefs.current[off.id]?.click()}
                    disabled={uploadingOfficerId === off.id}
                    className="text-[10px] font-semibold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                  >
                    <ImageUp className="w-3 h-3" />
                    {uploadingOfficerId === off.id ? 'Mengunggah...' : 'Ganti Foto'}
                  </button>
                  <input
                    ref={(el) => {
                      fileInputRefs.current[off.id] = el;
                    }}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handlePhotoChange(off, e)}
                  />
                  <button
                    type="button"
                    onClick={() => handleToggleClick(off)}
                    className={`text-[10px] font-semibold flex items-center gap-1 cursor-pointer ${
                      off.is_active ? 'text-red-500 hover:text-red-700' : 'text-emerald-600 hover:text-emerald-800'
                    }`}
                  >
                    {off.is_active ? (
                      <>
                        <Ban className="w-3 h-3" /> Nonaktifkan
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" /> Aktifkan
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteClick(off)}
                    className="text-[10px] font-semibold text-slate-400 hover:text-red-600 flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal Input Tambah Petugas (di-portal ke document.body agar backdrop
          selalu menutupi seluruh viewport, tidak bergantung ancestor) */}
      {showAddModal && createPortal(
        <div
          id="add-officer-modal-backdrop"
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn"
        >
          <div className="bg-surface rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-slate-100 relative">
            <button
              onClick={() => {
                setShowAddModal(false);
                setNewOfficerName('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="p-3 bg-sky-50 rounded-2xl text-sky-600 mb-3">
                <UserPlus className="w-6 h-6" />
              </div>
              <h3 className="font-bold font-display text-lg text-slate-900">Tambah Petugas Baru</h3>
              <p className="text-xs text-slate-400 mt-1">Masukkan nama lengkap calon petugas yang akan ditambahkan.</p>
            </div>

            <form onSubmit={handleAddOfficerFormSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nama Lengkap Petugas</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newOfficerName}
                  onChange={(e) => setNewOfficerName(e.target.value)}
                  placeholder="cth. Wahyu Kiswatiningsih, SST"
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-sky-500"
                />
              </div>

              <button
                type="submit"
                disabled={!newOfficerName.trim()}
                className="w-full bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold py-3 rounded-xl shadow-lg shadow-sky-600/20 transition duration-150 text-xs cursor-pointer"
              >
                Tambah Petugas
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modal Konfirmasi (tambah/nonaktifkan/hapus) */}
      {confirmModalProps && (
        <ConfirmModal
          open={!!pendingAction}
          title={confirmModalProps.title}
          message={confirmModalProps.message}
          confirmLabel={confirmModalProps.confirmLabel}
          variant={confirmModalProps.variant}
          isProcessing={isProcessingAction}
          onConfirm={handleConfirm}
          onCancel={() => setPendingAction(null)}
        />
      )}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
