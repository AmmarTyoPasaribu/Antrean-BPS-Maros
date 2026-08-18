'use client';

import React, { useEffect, useMemo, useState } from 'react';
import type { ServiceDisplay, Officer } from '@/lib/types';
import { resolveOfficerImage } from '@/lib/ui';
import { ArrowUp, ArrowDown, X, ListOrdered, Shuffle, Plus, RotateCcw } from 'lucide-react';
import Toast, { type ToastState } from './Toast';

interface RotationEntry {
  officerId: string;
  name: string;
  photoUrl: string | null;
}

interface RotationApiRow {
  officer_id: string;
  order_index: number;
  officers: { id: string; name: string; photo_url: string | null } | null;
}

interface RotationManagerProps {
  services: ServiceDisplay[];
  officers: Officer[];
}

export default function RotationManager({ services, officers }: RotationManagerProps) {
  const [rotations, setRotations] = useState<Record<string, RotationEntry[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingServiceId, setSavingServiceId] = useState<string | null>(null);
  const [addSelections, setAddSelections] = useState<Record<string, string>>({});
  const [resettingServiceId, setResettingServiceId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Fetch once per distinct set of service ids, not on every `services`
  // re-render — `services` gets a new array reference on every realtime
  // update (e.g. someone else editing an unrelated officer's photo), which
  // would otherwise re-trigger this fetch and clobber in-flight optimistic
  // edits made via saveRotation() below.
  const serviceIds = useMemo(() => services.map((s) => s.id).join(','), [services]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      setLoading(true);
      const entries = await Promise.all(
        services.map(async (srv) => {
          const res = await fetch(`/api/rotation?serviceId=${srv.id}`);
          const body: { rotation?: RotationApiRow[] } = await res.json().catch(() => ({}));
          const list: RotationEntry[] = (body.rotation ?? []).map((r) => ({
            officerId: r.officer_id,
            name: r.officers?.name ?? '-',
            photoUrl: r.officers?.photo_url ?? null,
          }));
          return [srv.id, list] as const;
        })
      );
      if (!cancelled) {
        setRotations(Object.fromEntries(entries));
        setLoading(false);
      }
    }

    if (serviceIds) loadAll();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceIds]);

  const saveRotation = async (serviceId: string, list: RotationEntry[]) => {
    setRotations((prev) => ({ ...prev, [serviceId]: list }));
    setSavingServiceId(serviceId);
    try {
      await fetch('/api/rotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId, officerIds: list.map((o) => o.officerId) }),
      });
    } finally {
      setSavingServiceId(null);
    }
  };

  const handleAdd = (serviceId: string) => {
    const officerId = addSelections[serviceId];
    if (!officerId) return;
    const officer = officers.find((o) => o.id === officerId);
    if (!officer) return;
    const current = rotations[serviceId] ?? [];
    if (current.some((r) => r.officerId === officerId)) return;
    const next = [...current, { officerId: officer.id, name: officer.name, photoUrl: officer.photo_url }];
    saveRotation(serviceId, next);
    setAddSelections((prev) => ({ ...prev, [serviceId]: '' }));
  };

  const handleRemove = (serviceId: string, officerId: string) => {
    const current = rotations[serviceId] ?? [];
    saveRotation(
      serviceId,
      current.filter((r) => r.officerId !== officerId)
    );
  };

  const handleMove = (serviceId: string, index: number, direction: -1 | 1) => {
    const current = rotations[serviceId] ?? [];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= current.length) return;
    const next = [...current];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    saveRotation(serviceId, next);
  };

  // Paksa petugas bertugas HARI INI kembali ke posisi pertama daftar rotasi
  // loket ini (dipakai kalau mis. urutan sudah lanjut jauh dan admin mau
  // "mulai ulang" dari awal tanpa menunggu siklus penuh berputar).
  const handleResetToFirst = async (srv: ServiceDisplay) => {
    const list = rotations[srv.id] ?? [];
    if (list.length === 0) return;
    const first = list[0];

    setResettingServiceId(srv.id);
    try {
      const res = await fetch('/api/assignment/override', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ serviceId: srv.id, officerId: first.officerId }),
      });
      if (res.ok) {
        setToast({ type: 'success', message: `${srv.name}: rotasi diulang ke ${first.name} (posisi pertama).` });
      } else {
        setToast({ type: 'error', message: 'Gagal mengulang rotasi ke posisi pertama.' });
      }
    } catch {
      setToast({ type: 'error', message: 'Gagal mengulang rotasi ke posisi pertama.' });
    } finally {
      setResettingServiceId(null);
    }
  };

  return (
    <div id="rotation-manager-container" className="bg-surface rounded-3xl border border-slate-100 shadow-sm p-5 glow-card space-y-4">
      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
        <div className="p-2 bg-sky-50 text-sky-600 rounded-xl">
          <ListOrdered className="w-4 h-4" />
        </div>
        <div>
          <h3 className="font-bold font-display text-slate-800 text-sm">Atur Rotasi Harian per Loket</h3>
          <span className="text-[10px] font-medium text-slate-400">
            Urutan petugas bertugas otomatis bergilir setiap hari (00:00 WITA)
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {services.map((srv) => {
          const list = rotations[srv.id] ?? [];
          const availableToAdd = officers.filter((o) => o.is_active && !list.some((r) => r.officerId === o.id));
          const isSaving = savingServiceId === srv.id;

          return (
            <div key={srv.id} id={`rotation-panel-${srv.id}`} className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[9px] font-mono font-bold text-sky-600 uppercase mr-1.5">LOKET {srv.loket_number}</span>
                  <h4 className="font-bold text-xs text-slate-800 leading-tight mt-0.5">{srv.name}</h4>
                </div>
                <button
                  type="button"
                  id={`rotation-reset-btn-${srv.id}`}
                  onClick={() => handleResetToFirst(srv)}
                  disabled={list.length === 0 || resettingServiceId === srv.id}
                  title="Ulang rotasi ke posisi pertama untuk hari ini"
                  className="p-2 bg-amber-100 text-amber-700 hover:bg-amber-200 rounded-lg transition cursor-pointer disabled:opacity-30 disabled:hover:bg-amber-100 shrink-0"
                >
                  <RotateCcw className={`w-5 h-5 ${resettingServiceId === srv.id ? 'animate-spin' : ''}`} />
                </button>
              </div>

              {loading ? (
                <div className="text-[11px] text-slate-400 py-4 text-center">Memuat...</div>
              ) : list.length === 0 ? (
                <div className="bg-surface rounded-xl border border-dashed border-slate-200 p-3 flex items-start gap-2">
                  <Shuffle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-[10px] text-slate-400 leading-relaxed">
                    Belum ada rotasi diatur. Sistem akan memilih petugas secara acak setiap hari.
                  </span>
                </div>
              ) : (
                <ol className="space-y-1.5">
                  {list.map((entry, index) => {
                    const isCurrent = entry.officerId === srv.officerId;
                    return (
                    <li
                      key={entry.officerId}
                      className={`border rounded-xl p-2 flex items-center gap-2 transition-colors ${
                        isCurrent ? 'bg-emerald-50 border-emerald-200' : 'bg-surface border-slate-100'
                      }`}
                    >
                      <span className={`text-[10px] font-bold w-4 text-center shrink-0 ${isCurrent ? 'text-emerald-600' : 'text-slate-400'}`}>{index + 1}</span>
                      <img
                        src={resolveOfficerImage(entry.photoUrl)}
                        alt={entry.name}
                        className={`w-7 h-7 rounded-lg object-cover border shrink-0 ${isCurrent ? 'border-emerald-300' : 'border-slate-200'}`}
                        referrerPolicy="no-referrer"
                      />
                      <span className={`text-[11px] font-semibold truncate flex-grow ${isCurrent ? 'text-emerald-800' : 'text-slate-700'}`}>
                        {entry.name}
                        {isCurrent && <span className="ml-1.5 text-[9px] font-bold text-emerald-600 uppercase">• Bertugas</span>}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMove(srv.id, index, -1)}
                          disabled={index === 0 || isSaving}
                          className="p-1 text-slate-400 hover:text-sky-600 disabled:opacity-30 cursor-pointer"
                          title="Naikkan urutan"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMove(srv.id, index, 1)}
                          disabled={index === list.length - 1 || isSaving}
                          className="p-1 text-slate-400 hover:text-sky-600 disabled:opacity-30 cursor-pointer"
                          title="Turunkan urutan"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(srv.id, entry.officerId)}
                          disabled={isSaving}
                          className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-30 cursor-pointer"
                          title="Hapus dari rotasi"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </li>
                    );
                  })}
                </ol>
              )}

              {/* Tambah ke rotasi */}
              <div className="flex gap-1.5 pt-1">
                <select
                  value={addSelections[srv.id] ?? ''}
                  onChange={(e) => setAddSelections((prev) => ({ ...prev, [srv.id]: e.target.value }))}
                  disabled={isSaving || availableToAdd.length === 0}
                  className="flex-grow bg-surface border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-700 focus:outline-none focus:border-sky-500 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <option value="">
                    {availableToAdd.length === 0 ? 'Semua petugas aktif sudah masuk rotasi' : '-- Tambah ke rotasi --'}
                  </option>
                  {availableToAdd.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => handleAdd(srv.id)}
                  disabled={isSaving || !addSelections[srv.id]}
                  className="p-1.5 bg-sky-600 hover:bg-sky-700 disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-lg transition cursor-pointer shrink-0"
                  title="Tambahkan"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}
