'use client';

import React from 'react';
import type { QueueItem, ServiceDisplay } from '@/lib/types';
import { resolveOfficerImage } from '@/lib/ui';

interface VisitorMonitorProps {
  services: ServiceDisplay[];
  queues: QueueItem[];
}

export default function VisitorMonitor({ services, queues }: VisitorMonitorProps) {
  // Get active/calling queue for a service
  const getCallingQueue = (serviceId: string) => {
    return queues.find((q) => q.service_id === serviceId && q.status === 'calling');
  };

  // Get next waiting queue for a service
  const getNextWaitingQueue = (serviceId: string) => {
    // Queues are chronological, find first one with 'waiting' status
    return queues.find((q) => q.service_id === serviceId && q.status === 'waiting');
  };

  return (
    <div id="visitor-monitor-container" className="space-y-6">
      {/* 3 Services Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {services.map((srv) => {
          const calling = getCallingQueue(srv.id);
          const nextUp = getNextWaitingQueue(srv.id);
          const waitingCount = queues.filter((q) => q.service_id === srv.id && q.status === 'waiting').length;

          return (
            <div
              key={srv.id}
              id={`monitor-card-${srv.id}`}
              className={`bg-white rounded-3xl border border-slate-100 shadow-xl overflow-hidden flex flex-col justify-between transition-all duration-300 relative glow-card ${
                calling ? 'ring-2 ring-sky-500 ring-offset-2' : ''
              }`}
            >
              {/* Card top banner with Service name and Loket */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-mono font-bold text-sky-600 uppercase tracking-widest">LAYANAN {srv.code}</span>
                  <h4 className="font-bold text-slate-800 font-display text-sm leading-tight">{srv.name}</h4>
                </div>
                <div className="bg-slate-900 text-white font-bold px-3 py-1.5 rounded-xl text-xs font-display tracking-tight shadow-md">
                  LOKET {srv.loket_number}
                </div>
              </div>

              {/* Main Display: Called Queue Number */}
              <div className="p-6 flex flex-col items-center justify-center min-h-[160px] relative text-center">
                {calling ? (
                  <div className="flex flex-col items-center">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full uppercase tracking-wider mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      Sedang Dipanggil
                    </span>
                    <h1 className="text-6xl font-extrabold font-display tracking-tight text-slate-900">
                      {calling.number}
                    </h1>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-slate-300">
                    <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider mb-3">
                      LOKET ISTIRAHAT
                    </span>
                    <h1 className="text-5xl font-bold font-display tracking-tight my-1 text-slate-300">
                      - - -
                    </h1>
                  </div>
                )}
              </div>

              {/* Next Waiting Queue Block */}
              <div className="mx-6 p-4 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between text-xs text-slate-600">
                <span className="font-medium text-slate-400 uppercase tracking-wider text-[10px]">Nomor Berikutnya:</span>
                <span className="font-bold font-display text-slate-700 text-sm">
                  {nextUp ? nextUp.number : 'KOSONG'}
                </span>
              </div>

              {/* Staff Details Card Footer */}
              <div className="p-5 mt-4 border-t border-slate-100 flex items-center justify-between bg-slate-50/60">
                <div className="flex items-center gap-5">
                  <div className="relative shrink-0">
                    <img
                      src={resolveOfficerImage(srv.officerImage)}
                      alt={srv.officerName}
                      className="w-32 h-32 rounded-3xl object-cover border-2 border-sky-600 shadow-xl shadow-sky-600/20"
                      referrerPolicy="no-referrer"
                    />
                    <span className="absolute bottom-1 right-1 w-5 h-5 bg-emerald-500 border-2 border-white rounded-full"></span>
                  </div>
                  <div>
                    <span className="text-[11px] font-bold text-sky-600 uppercase tracking-widest block mb-1.5">Petugas hari ini</span>
                    <p className="text-base font-extrabold text-slate-900 leading-tight">{srv.officerName}</p>
                  </div>
                </div>

                {/* Micro stat */}
                <div className="text-right shrink-0">
                  <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">MENUNGGU</span>
                  <span className="font-bold text-slate-700 font-display text-base">{waitingCount} org</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
