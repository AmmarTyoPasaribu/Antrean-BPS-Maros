'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import type { ServiceDisplay, QueueItem, Officer, ActionResult } from '@/lib/types';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { fetchServicesWithOfficers, fetchQueues, fetchOfficers } from '@/lib/queue-data-client';
import { playQueueAnnouncement } from '@/lib/voice';
import VisitorMonitor from './VisitorMonitor';
import AdminPanel from './AdminPanel';
import OfficerManagement from './OfficerManagement';
import RotationManager from './RotationManager';
import { Monitor, Settings, Users, Clock, Lock, LogOut, X, CheckCircle2, BookOpen } from 'lucide-react';

interface AntreanAppProps {
  initialServices: ServiceDisplay[];
  initialQueues: QueueItem[];
  initialOfficers: Officer[];
  initialIsAdmin: boolean;
}

export default function AntreanApp({
  initialServices,
  initialQueues,
  initialOfficers,
  initialIsAdmin,
}: AntreanAppProps) {
  const [services, setServices] = useState<ServiceDisplay[]>(initialServices);
  const [queues, setQueues] = useState<QueueItem[]>(initialQueues);
  const [officers, setOfficers] = useState<Officer[]>(initialOfficers);

  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState<boolean>(initialIsAdmin);
  const [layoutMode, setLayoutMode] = useState<'visitor' | 'admin' | 'petugas'>(initialIsAdmin ? 'admin' : 'visitor');
  const [currentTime, setCurrentTime] = useState<string>('');

  const [selectedService, setSelectedService] = useState<string>(initialServices[0]?.slug ?? 'statistik');
  const [successMessage, setSuccessMessage] = useState<string>('');

  const [showLoginModal, setShowLoginModal] = useState<boolean>(false);
  const [loginUsername, setLoginUsername] = useState<string>('');
  const [loginPassword, setLoginPassword] = useState<string>('');
  const [loginError, setLoginError] = useState<string>('');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);

  // Clock tick
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      const dateStr = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const timeStr = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      setCurrentTime(`${dateStr} — ${timeStr} WIB`);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Realtime sync: any change to queues / today's officer assignment / officer
  // roster refreshes state so the visitor monitor and admin panel stay in
  // sync across separate devices/browsers without a manual refresh.
  //
  // Each refresh is token-guarded: if several postgres_changes events fire in
  // quick succession, their fetches can resolve out of order over the
  // network. Without the guard, an older (stale) response resolving after a
  // newer one would silently overwrite fresher state. Only the response for
  // the most recently triggered fetch is ever committed.
  useEffect(() => {
    let queuesToken = 0;
    let servicesToken = 0;
    let officersToken = 0;

    const refreshQueues = () => {
      const myToken = ++queuesToken;
      fetchQueues().then((data) => {
        if (myToken === queuesToken) setQueues(data);
      });
    };
    const refreshServices = () => {
      const myToken = ++servicesToken;
      fetchServicesWithOfficers().then((data) => {
        if (myToken === servicesToken) setServices(data);
      });
    };
    const refreshOfficers = () => {
      const myToken = ++officersToken;
      fetchOfficers().then((data) => {
        if (myToken === officersToken) setOfficers(data);
      });
    };

    const channel = supabaseBrowser
      .channel('antrean-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'queues' }, refreshQueues)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_officer_assignment' }, refreshServices)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'officers' }, () => {
        refreshServices();
        refreshOfficers();
      })
      .subscribe();

    return () => {
      supabaseBrowser.removeChannel(channel);
    };
  }, []);

  // Action: Add new queue
  const handleTakeQueue = async (serviceSlug: string) => {
    const serviceInfo = services.find((s) => s.slug === serviceSlug);
    if (!serviceInfo) return;

    const { data, error } = await supabaseBrowser.rpc('take_queue', { p_service_slug: serviceSlug });
    if (error || !data) return;

    const newQueue = data as QueueItem;
    setQueues((prev) => [...prev, newQueue]);
    setSuccessMessage(`Berhasil mengambil antrian: nomor Anda adalah ${newQueue.number} (${serviceInfo.name}). Silakan menunggu.`);
    setTimeout(() => setSuccessMessage(''), 6000);
  };

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setLoginError(body.error || 'Username atau Password salah!');
        return;
      }
      setIsAdminAuthenticated(true);
      setShowLoginModal(false);
      setLoginError('');
      setLoginUsername('');
      setLoginPassword('');
      setLayoutMode('admin');
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Logout handler
  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setIsAdminAuthenticated(false);
    setLayoutMode('visitor');
  };

  // Action: Call next waiting queue
  const handleCallNext = async (serviceId: string) => {
    const res = await fetch('/api/queues/call-next', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId }),
    });
    if (!res.ok) return;
    const { queue } = await res.json();
    if (queue) playQueueAnnouncement(queue.number, queue.loket_number);
  };

  // Action: Re-call (Panggil Ulang)
  const handleRecall = async (queueId: string) => {
    const res = await fetch('/api/queues/recall', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId }),
    });
    if (!res.ok) return;
    const { queue } = await res.json();
    if (queue) playQueueAnnouncement(queue.number, queue.loket_number);
  };

  // Action: Skip (Lewati)
  const handleSkipQueue = async (queueId: string) => {
    await fetch('/api/queues/skip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId }),
    });
  };

  // Action: Complete (Selesaikan)
  const handleCompleteQueue = async (queueId: string) => {
    await fetch('/api/queues/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queueId }),
    });
  };

  // Action: Reset all queues
  const handleResetQueues = async (): Promise<ActionResult> => {
    const res = await fetch('/api/queues/reset', { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || 'Gagal mereset antrean' };
    }
    return { ok: true };
  };

  // Action: Tambah petugas baru
  const handleAddOfficer = async (name: string): Promise<ActionResult> => {
    const res = await fetch('/api/officers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || 'Gagal menambahkan petugas' };
    }
    return { ok: true };
  };

  // Action: Upload/ganti foto petugas
  const handleUploadOfficerPhoto = async (officerId: string, file: File): Promise<ActionResult> => {
    const formData = new FormData();
    formData.append('officerId', officerId);
    formData.append('file', file);
    const res = await fetch('/api/officers/upload-photo', { method: 'POST', body: formData });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || 'Gagal mengunggah foto' };
    }
    return { ok: true };
  };

  // Action: Aktifkan/nonaktifkan petugas
  const handleToggleOfficerActive = async (officerId: string, isActive: boolean): Promise<ActionResult> => {
    const res = await fetch(`/api/officers/${officerId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: isActive }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || 'Gagal mengubah status petugas' };
    }
    return { ok: true };
  };

  // Action: Hapus petugas permanen (ditolak server kalau punya riwayat penugasan)
  const handleDeleteOfficer = async (officerId: string): Promise<ActionResult> => {
    const res = await fetch(`/api/officers/${officerId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body.error || 'Gagal menghapus petugas' };
    }
    return { ok: true };
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans selection:bg-sky-500/10 selection:text-sky-600">
      {/* Top Professional Header */}
      <header id="app-main-header" className="bg-white border-b border-slate-200/80 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col sm:flex-row justify-between items-center gap-4">
          {/* Logo & Office Brand */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="p-1 bg-transparent rounded-xl flex items-center justify-center shrink-0">
              <img
                src="/images/Logo BPS.png"
                alt="Logo BPS"
                className="w-12 h-10 object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <h1
                className="leading-tight tracking-wider text-slate-950 flex flex-col"
                style={{ fontFamily: "'Arial', sans-serif", fontWeight: 'bold', fontStyle: 'italic' }}
              >
                <span className="text-sm uppercase whitespace-nowrap">BADAN PUSAT STATISTIK</span>
                <span className="text-sm text-slate-950 uppercase mt-0.5 whitespace-nowrap">KABUPATEN MAROS</span>
              </h1>
            </div>
          </div>

          {/* Clock Info & Layout Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Clock */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs text-slate-500 font-medium">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{currentTime}</span>
            </div>

            {isAdminAuthenticated ? (
              <div className="flex items-center gap-3">
                {/* Layout Toggle Segment Controller */}
                <div className="bg-slate-100 p-1 rounded-2xl flex border border-slate-200/50">
                  <button
                    id="layout-btn-visitor"
                    onClick={() => setLayoutMode('visitor')}
                    title="Tampilan Monitor Utama Publik"
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                      layoutMode === 'visitor'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/20'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Layar Monitor</span>
                  </button>
                  <button
                    id="layout-btn-admin"
                    onClick={() => setLayoutMode('admin')}
                    title="Panel Admin Operator"
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                      layoutMode === 'admin'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/20'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Settings className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Panel Admin</span>
                  </button>
                  <button
                    id="layout-btn-petugas"
                    onClick={() => setLayoutMode('petugas')}
                    title="Kelola Data Petugas"
                    className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition flex items-center gap-1.5 cursor-pointer ${
                      layoutMode === 'petugas'
                        ? 'bg-white text-slate-900 shadow-sm border border-slate-200/20'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Kelola Petugas</span>
                  </button>
                </div>

                {/* Logout Button */}
                <button
                  id="admin-logout-btn"
                  onClick={handleLogout}
                  className="bg-slate-50 border border-slate-200/60 hover:bg-slate-100 text-slate-600 hover:text-slate-800 px-3.5 py-2 rounded-2xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5 text-slate-400" />
                  <span>Logout</span>
                </button>

                <Link
                  href="/buku-tamu"
                  id="admin-buku-tamu-skd-link"
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/10 transition cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Buku Tamu & SKD</span>
                </Link>
              </div>
            ) : (
              /* Login Admin Button & Buku Tamu & SKD for Visitors */
              <div className="flex items-center gap-2">
                <button
                  id="admin-login-trigger-btn"
                  onClick={() => setShowLoginModal(true)}
                  className="bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-sky-600/10 transition cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Login Admin</span>
                </button>
                <Link
                  href="/buku-tamu"
                  id="buku-tamu-skd-link"
                  className="bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] text-white px-4 py-2 rounded-2xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-emerald-600/10 transition cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Buku Tamu & SKD</span>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Running Text Banner */}
      <div id="running-text-banner" className="bg-orange-600 text-white py-2.5 shadow-md overflow-hidden border-b border-orange-700 select-none relative flex items-center">
        <div className="w-full overflow-hidden relative flex items-center">
          <div className="animate-marquee-custom text-xs sm:text-sm font-semibold tracking-wide flex items-center gap-12 whitespace-nowrap">
            <span>SELAMAT DATANG DI PELAYANAN STATISTIK TERPADU BPS KABUPATEN MAROS</span>
            <span className="text-yellow-300 font-extrabold text-lg">•</span>
            <span>TERIMA KEDATANGAN PETUGAS SENSUS EKONOMI 2026. SENSUS EKONOMI 2026 - MENCATAT EKONOMI INDONESIA!</span>
            <span className="text-yellow-300 font-extrabold text-lg">•</span>
            {/* Duplicated for infinite continuous looping */}
            <span>SELAMAT DATANG DI PELAYANAN STATISTIK TERPADU BPS KABUPATEN MAROS</span>
            <span className="text-yellow-300 font-extrabold text-lg">•</span>
            <span>TERIMA KEDATANGAN PETUGAS SENSUS EKONOMI 2026. SENSUS EKONOMI 2026 - MENCATAT EKONOMI INDONESIA!</span>
            <span className="text-yellow-300 font-extrabold text-lg">•</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main id="app-main-content" className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Dynamic Display based on layoutMode */}
        {layoutMode === 'visitor' && (
          <div className="space-y-8">
            {/* Merged Jam Operasional & Ambil Antrian Card */}
            <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 space-y-5 transition-all duration-300">
              {/* Top Part: Jam Operasional */}
              <div id="jam-operasional-container" className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 text-slate-800">
                  <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl shrink-0">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base font-display text-slate-900 tracking-tight">
                      Jam Operasional Layanan BPS Kabupaten Maros
                    </h3>
                    <p className="text-xs text-slate-500 font-medium">
                      Silakan datang sesuai dengan ketentuan jam operasional layanan kami.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                  <div className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl flex-1 md:flex-initial text-center md:text-left min-w-[200px]">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Senin - Kamis</span>
                    <span className="text-sm font-extrabold text-slate-800">Pukul 07.30 - 16.00 WITA</span>
                  </div>
                  <div className="bg-slate-50 border border-slate-100 px-4 py-2 rounded-2xl flex-1 md:flex-initial text-center md:text-left min-w-[180px]">
                    <span className="text-[10px] font-bold text-slate-400 block uppercase tracking-wider">Jumat</span>
                    <span className="text-sm font-extrabold text-slate-800">Pukul 07.30 - 16.30 WITA</span>
                  </div>
                </div>
              </div>

              {/* Horizontal Divider */}
              <hr className="border-slate-100" />

              {/* Bottom Part: Ambil Antrian */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-1 shrink-0">
                  <span className="text-[10px] font-bold text-sky-600 uppercase tracking-widest block">Registrasi Antrian Mandiri</span>
                  <h3 className="text-lg font-bold font-display text-slate-900">Pilih Layanan & Ambil Antrian</h3>
                  <p className="text-xs text-slate-400">Silakan pilih jenis pelayanan di samping untuk mendapatkan nomor antrian Anda.</p>
                </div>

                <div className="flex-grow flex flex-col sm:flex-row gap-3.5 items-stretch md:justify-end">
                  {/* Custom Dropdown Selector */}
                  <div className="relative min-w-[260px]">
                    <select
                      id="form-service-select"
                      value={selectedService}
                      onChange={(e) => setSelectedService(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-200/80 hover:border-slate-300 text-slate-800 font-semibold py-3 px-4 pr-10 rounded-2xl transition duration-150 focus:outline-none focus:border-sky-500 text-sm cursor-pointer"
                    >
                      {services.map((srv) => (
                        <option key={srv.id} value={srv.slug}>
                          [{srv.code}] {srv.name} (Loket {srv.loket_number})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Action Button */}
                  <button
                    id="ambil-antrian-baru-btn"
                    onClick={() => handleTakeQueue(selectedService)}
                    className="bg-sky-600 hover:bg-sky-700 active:scale-[0.98] text-white font-bold px-7 py-3 rounded-2xl shadow-lg shadow-sky-600/20 transition duration-150 flex items-center justify-center gap-2 text-sm cursor-pointer whitespace-nowrap animate-pulse hover:animate-none"
                  >
                    Ambil Antrian Baru
                  </button>
                </div>
              </div>

              {/* Quiet success notification message below */}
              {successMessage && (
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-2.5 text-xs text-emerald-800 font-semibold animate-fadeIn">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}
            </div>

            {/* Monitor panel (larger size taking full width) */}
            <VisitorMonitor services={services} queues={queues} />
          </div>
        )}

        {layoutMode === 'admin' && (
          <div className="space-y-6">
            <AdminPanel
              services={services}
              queues={queues}
              onCallNext={handleCallNext}
              onRecall={handleRecall}
              onSkipQueue={handleSkipQueue}
              onCompleteQueue={handleCompleteQueue}
              onResetQueues={handleResetQueues}
            />
          </div>
        )}

        {layoutMode === 'petugas' && (
          <div className="space-y-6">
            <RotationManager services={services} officers={officers} />
            <OfficerManagement
              officers={officers}
              onAddOfficer={handleAddOfficer}
              onUploadOfficerPhoto={handleUploadOfficerPhoto}
              onToggleOfficerActive={handleToggleOfficerActive}
              onDeleteOfficer={handleDeleteOfficer}
            />
          </div>
        )}
      </main>

      {/* Login Modal Overlay (di-portal ke document.body agar backdrop
          selalu menutupi seluruh viewport, tidak bergantung ancestor) */}
      {showLoginModal && createPortal(
        <div id="login-modal-backdrop" className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm border border-slate-100 relative">
            <button
              onClick={() => {
                setShowLoginModal(false);
                setLoginError('');
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition p-1 hover:bg-slate-100 rounded-full cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex flex-col items-center text-center mb-6">
              <div className="p-3 bg-sky-50 rounded-2xl text-sky-600 mb-3">
                <Lock className="w-6 h-6" />
              </div>
              <h3 className="font-bold font-display text-lg text-slate-900">Login Operator Admin</h3>
              <p className="text-xs text-slate-400 mt-1">Silakan masukkan kredensial admin untuk mengakses panel kontrol.</p>
            </div>

            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Username</label>
                <input
                  type="text"
                  required
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-sky-500"
                />
              </div>

              {loginError && (
                <p className="text-xs font-bold text-red-500 bg-red-50 px-3 py-2 rounded-xl text-center">
                  {loginError}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-sky-600/20 transition duration-150 text-xs cursor-pointer disabled:opacity-70"
              >
                Masuk Sekarang
              </button>
            </form>
          </div>
        </div>,
        document.body
      )}

      {/* Modern Compact Footer */}
      <footer id="app-main-footer" className="bg-white border-t border-slate-200 py-6 mt-12 text-center text-xs text-slate-400">
        <div className="max-w-7xl mx-auto px-4 space-y-2">
          <p className="font-semibold text-slate-500 font-display">Aplikasi Antrean Online BPS Kabupaten Maros © 2026</p>
          <p>- Tim IPDS (Integrasi Pengolahan, Diseminasi, dan Publikasi Statistik) -</p>
          <div className="flex justify-center gap-4 text-[10px] font-semibold text-slate-400/80 uppercase tracking-widest pt-1">
            <span>Responsive Layout</span>
            <span>•</span>
            <span>Indonesian Voice Synthesis Enabled</span>
            <span>•</span>
            <span>Local Offline Persistence</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
