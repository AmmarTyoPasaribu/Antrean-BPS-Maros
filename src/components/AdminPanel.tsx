'use client';

import React, { useState } from 'react';
import type { QueueItem, ServiceDisplay, ActionResult } from '@/lib/types';
import { formatClockTime, formatDate } from '@/lib/ui';
import Toast, { type ToastState } from './Toast';
import ConfirmModal from './ConfirmModal';
import {
  Play,
  Clock,
  Trash2,
  ListOrdered,
  CheckCheck,
  Megaphone,
  SkipForward,
  UserCheck,
  Download,
  FileSpreadsheet,
} from 'lucide-react';

interface AdminPanelProps {
  services: ServiceDisplay[];
  queues: QueueItem[];
  onCallNext: (serviceId: string) => void;
  onRecall: (queueId: string) => void;
  onSkipQueue: (queueId: string) => void;
  onCompleteQueue: (queueId: string) => void;
  onResetQueues: () => Promise<ActionResult>;
}

export default function AdminPanel({
  services,
  queues,
  onCallNext,
  onRecall,
  onSkipQueue,
  onCompleteQueue,
  onResetQueues,
}: AdminPanelProps) {
  const [selectedServiceFilter, setSelectedServiceFilter] = useState<string | 'all'>('all');
  const [activeSubTab, setActiveSubTab] = useState<'waiting' | 'completed' | 'all'>('waiting');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  const handleConfirmReset = async () => {
    setIsResetting(true);
    try {
      const result = await onResetQueues();
      if (result.ok) {
        setToast({ type: 'success', message: 'Antrean hari ini berhasil direset.' });
      } else {
        setToast({ type: 'error', message: result.error || 'Gagal mereset antrean.' });
      }
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  // Filter queues
  const filteredQueues = queues.filter((q) => {
    const matchService = selectedServiceFilter === 'all' || q.service_id === selectedServiceFilter;
    if (!matchService) return false;

    if (activeSubTab === 'waiting') return q.status === 'waiting' || q.status === 'calling';
    if (activeSubTab === 'completed') return q.status === 'completed' || q.status === 'skipped';
    return true; // all
  });

  // Calculate statistics
  const totalToday = queues.length;
  const completedToday = queues.filter((q) => q.status === 'completed').length;
  const waitingToday = queues.filter((q) => q.status === 'waiting').length;

  const handleDownloadCSV = () => {
    // Generate CSV content
    const headers = ['No. Tiket', 'Layanan', 'Tanggal', 'Jam Dibuat', 'Nama Petugas', 'Status'];
    const rows = filteredQueues.map((q) => {
      const service = services.find((s) => s.id === q.service_id);
      const serviceName = service ? service.name : '-';
      const officerName = service ? service.officerName : '-';
      const dateStr = formatDate(q.created_at);
      const createdTime = formatClockTime(q.created_at);
      let statusStr = 'MENUNGGU';
      if (q.status === 'calling') statusStr = 'SEDANG DIPANGGIL';
      else if (q.status === 'completed') statusStr = 'SELESAI';
      else if (q.status === 'skipped') statusStr = 'LEWAT';

      return [q.number, serviceName, dateStr, createdTime, officerName, statusStr];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((value) => `"${value.replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // Create a Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `daftar_antrian_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div id="admin-panel-container" className="space-y-6">
      {/* 4 Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Queue */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm glow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Antrian</span>
            <h2 className="text-2xl font-bold font-display text-slate-800">{totalToday}</h2>
            <span className="text-[10px] text-slate-400">Hari ini</span>
          </div>
          <div className="p-3 bg-sky-50 rounded-xl text-sky-600">
            <ListOrdered className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Waiting */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm glow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Menunggu</span>
            <h2 className="text-2xl font-bold font-display text-amber-600">{waitingToday}</h2>
            <span className="text-[10px] text-slate-400">Butuh dilayani</span>
          </div>
          <div className="p-3 bg-amber-50 rounded-xl text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Completed */}
        <div className="bg-white rounded-2xl border border-slate-100 p-5 shadow-sm glow-card flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selesai</span>
            <h2 className="text-2xl font-bold font-display text-emerald-600">{completedToday}</h2>
            <span className="text-[10px] text-slate-400">Sukses dilayani</span>
          </div>
          <div className="p-3 bg-emerald-50 rounded-xl text-emerald-600">
            <CheckCheck className="w-5 h-5" />
          </div>
        </div>

        {/* Card 4: Akses Isian Buku Tamu */}
        <a
          href={process.env.NEXT_PUBLIC_GUEST_BOOK_SHEET_URL || '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="bg-emerald-50 rounded-2xl border border-emerald-100 p-5 shadow-sm hover:shadow-md hover:border-emerald-200 active:scale-[0.99] transition-all duration-200 glow-card flex items-center justify-between cursor-pointer group"
        >
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-emerald-700/80 uppercase tracking-wider block font-sans">Akses Isian Buku Tamu Disini</span>
            <h2 className="text-sm font-bold font-display text-emerald-800 group-hover:text-emerald-900 transition">
              Buka Google Sheets ↗
            </h2>
            <span className="text-[10px] text-emerald-600/70 block">Isian SKD & Buku Tamu</span>
          </div>
          <div className="p-3 bg-emerald-500 text-white rounded-xl group-hover:bg-emerald-600 transition">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
        </a>
      </div>

      {/* Main Admin Columns: Controls vs List/Logs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 1 Column: Officer Loket Action Cards */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 space-y-4 glow-card">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold font-display text-slate-800 text-sm">Panggilan Operator</h3>
              <button
                id="reset-all-btn"
                onClick={() => setShowResetConfirm(true)}
                className="text-[10px] font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded-lg transition flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" /> Reset Hari Ini
              </button>
            </div>

            {/* Loop through the 3 service controls */}
            <div className="space-y-3">
              {services.map((srv) => {
                const activeCalling = queues.find((q) => q.service_id === srv.id && q.status === 'calling');
                const waitingInLine = queues.filter((q) => q.service_id === srv.id && q.status === 'waiting').length;

                return (
                  <div key={srv.id} id={`control-panel-${srv.id}`} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3.5">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1 flex-grow">
                        <div>
                          <span className="text-[9px] font-mono font-bold text-sky-600 uppercase mr-1.5">LOKET {srv.loket_number}</span>
                          <span className="bg-slate-200 text-slate-700 font-bold px-1.5 py-0.5 rounded text-[9px] font-mono">
                            {waitingInLine} antri
                          </span>
                        </div>
                        <h4 className="font-bold text-xs text-slate-800 leading-tight">{srv.name}</h4>

                        {/* Petugas bertugas hari ini (read-only — diatur lewat Kelola Petugas > Atur Rotasi) */}
                        <div className="pt-1.5">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Petugas Bertugas:</span>
                          <span className="text-[11px] font-semibold text-slate-700">{srv.officerName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Active Ticket Caller Box */}
                    {activeCalling ? (
                      <div className="bg-white border border-sky-100 rounded-xl p-3 flex items-center justify-between">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 block uppercase">Sedang Melayani</span>
                          <span className="text-xl font-bold font-display text-sky-600">{activeCalling.number}</span>
                        </div>
                        <div className="flex gap-1.5">
                          {/* Recall Button */}
                          <button
                            id={`recall-btn-${activeCalling.id}`}
                            onClick={() => onRecall(activeCalling.id)}
                            title="Panggil Ulang Suara"
                            className="p-1.5 bg-sky-50 text-sky-600 hover:bg-sky-100 rounded-lg transition cursor-pointer"
                          >
                            <Megaphone className="w-3.5 h-3.5" />
                          </button>
                          {/* Skip Button */}
                          <button
                            id={`skip-btn-${activeCalling.id}`}
                            onClick={() => onSkipQueue(activeCalling.id)}
                            title="Lewati Antrian"
                            className="p-1.5 bg-amber-50 text-amber-600 hover:bg-amber-100 rounded-lg transition cursor-pointer"
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                          </button>
                          {/* Complete Button */}
                          <button
                            id={`complete-btn-${activeCalling.id}`}
                            onClick={() => onCompleteQueue(activeCalling.id)}
                            title="Selesaikan Layanan"
                            className="p-1.5 bg-emerald-500 text-white hover:bg-emerald-600 rounded-lg transition shadow-sm cursor-pointer"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-slate-100/60 rounded-xl p-3.5 border border-dashed border-slate-200 text-center">
                        <span className="text-[10px] font-medium text-slate-400">Tidak ada antrian aktif</span>
                      </div>
                    )}

                    {/* Panggil Selanjutnya Button */}
                    <button
                      id={`call-next-btn-${srv.id}`}
                      onClick={() => onCallNext(srv.id)}
                      disabled={waitingInLine === 0}
                      className={`w-full py-2.5 px-4 rounded-xl font-semibold text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                        waitingInLine > 0
                          ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-md shadow-sky-600/10'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Panggil Selanjutnya
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right 2 Columns: Lists and logs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Queues management block */}
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-5 glow-card">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <h3 className="font-bold font-display text-slate-800 text-sm">Daftar Antrian</h3>
                {activeSubTab === 'completed' && filteredQueues.length > 0 && (
                  <button
                    onClick={handleDownloadCSV}
                    className="flex items-center gap-1.5 px-2.5 py-1 bg-sky-50 hover:bg-sky-100 active:scale-[0.98] text-sky-700 text-[10px] font-bold rounded-lg transition-all cursor-pointer border border-sky-100"
                    title="Download Daftar Antrian (CSV)"
                  >
                    <Download className="w-3 h-3" />
                    <span>Download CSV</span>
                  </button>
                )}
              </div>

              {/* Filter controls */}
              <div className="flex flex-wrap items-center gap-2">
                {/* Service Filter dropdown */}
                <select
                  id="admin-service-filter"
                  value={selectedServiceFilter}
                  onChange={(e) => setSelectedServiceFilter(e.target.value)}
                  className="bg-slate-50 border border-slate-200 text-slate-600 font-medium py-1 px-2.5 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                >
                  <option value="all">Semua Layanan</option>
                  {services.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.name}
                    </option>
                  ))}
                </select>

                {/* Sub-tab filter buttons */}
                <div className="bg-slate-100 p-0.5 rounded-lg flex">
                  <button
                    id="sub-tab-waiting"
                    onClick={() => setActiveSubTab('waiting')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      activeSubTab === 'waiting' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Antrian
                  </button>
                  <button
                    id="sub-tab-completed"
                    onClick={() => setActiveSubTab('completed')}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition ${
                      activeSubTab === 'completed' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    Selesai
                  </button>
                </div>
              </div>
            </div>

            {/* Queue Table */}
            <div className="overflow-x-auto mt-4">
              {filteredQueues.length === 0 ? (
                <div className="py-12 text-center">
                  <span className="text-slate-300 font-display font-medium text-sm block">Tidak ada antrian untuk filter ini</span>
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="py-2.5">No. Tiket</th>
                      <th className="py-2.5">Layanan</th>
                      <th className="py-2.5">Tanggal</th>
                      <th className="py-2.5">Dibuat</th>
                      <th className="py-2.5">Nama Petugas</th>
                      <th className="py-2.5 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-xs font-medium text-slate-600">
                    {filteredQueues.map((q) => {
                      const service = services.find((s) => s.id === q.service_id);
                      const officerName = service ? service.officerName : '-';
                      return (
                        <tr key={q.id} className="hover:bg-slate-50/50">
                          <td className="py-3 font-bold font-display text-slate-950 text-sm">{q.number}</td>
                          <td className="py-3">
                            <span className="text-slate-500">
                              {service?.slug === 'statistik' ? 'Statistik' : service?.slug === 'pengaduan' ? 'Pengaduan' : 'PPID'}
                            </span>
                          </td>
                          <td className="py-3 font-mono">{formatDate(q.created_at)}</td>
                          <td className="py-3 font-mono">{formatClockTime(q.created_at)}</td>
                          <td className="py-3 text-slate-700 font-semibold">{officerName}</td>
                          <td className="py-3 text-right">
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${
                                q.status === 'calling'
                                  ? 'bg-sky-50 text-sky-700 border border-sky-100 animate-pulse'
                                  : q.status === 'completed'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : q.status === 'skipped'
                                  ? 'bg-red-50 text-red-600'
                                  : 'bg-slate-100 text-slate-500'
                              }`}
                            >
                              {q.status === 'calling'
                                ? 'SEDANG DIPANGGIL'
                                : q.status === 'completed'
                                ? 'SELESAI'
                                : q.status === 'skipped'
                                ? 'LEWAT'
                                : 'MENUNGGU'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={showResetConfirm}
        title="Reset Antrean Hari Ini?"
        message="Semua nomor antrian yang masih menunggu/dipanggil hari ini akan ditandai dilewati. Riwayat yang sudah selesai tetap tersimpan permanen. Tindakan ini tidak bisa dibatalkan."
        confirmLabel="Ya, Reset"
        variant="danger"
        isProcessing={isResetting}
        onConfirm={handleConfirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
