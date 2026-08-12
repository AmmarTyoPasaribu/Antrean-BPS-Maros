'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ArrowLeft, BookOpen } from 'lucide-react';

const TODAY_LABEL = () =>
  new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Makassar',
  });

const EMPTY_FORM = {
  visitorName: '',
  gender: '',
  occupation: '',
  institution: '',
  visitPurpose: '',
  email: '',
  whatsappNumber: '',
};

export default function BukuTamuPage() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [todayLabel, setTodayLabel] = useState('');

  useEffect(() => {
    setTodayLabel(TODAY_LABEL());
  }, []);

  useEffect(() => {
    if (!submitted) return;
    const timer = setTimeout(() => {
      setSubmitted(false);
      setForm(EMPTY_FORM);
    }, 3000);
    return () => clearTimeout(timer);
  }, [submitted]);

  const handleChange = (field: keyof typeof EMPTY_FORM) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/guest-book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error || 'Gagal mengirim data, silakan coba lagi.');
        return;
      }
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans">
      <header id="guest-book-header" className="bg-white border-b border-slate-200/80">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-3.5 flex items-center gap-3">
          <img src="/images/Logo BPS.png" alt="Logo BPS" className="w-10 h-9 object-contain" referrerPolicy="no-referrer" />
          <div>
            <h1
              className="leading-tight tracking-wider text-slate-950 flex flex-col"
              style={{ fontFamily: "'Arial', sans-serif", fontWeight: 'bold', fontStyle: 'italic' }}
            >
              <span className="text-xs uppercase">BADAN PUSAT STATISTIK</span>
              <span className="text-xs text-slate-950 uppercase">KABUPATEN MAROS</span>
            </h1>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-2xl w-full mx-auto px-4 sm:px-6 py-10">
        {submitted ? (
          <div id="guest-book-thank-you" className="bg-white rounded-3xl border border-slate-100 shadow-xl p-10 flex flex-col items-center text-center animate-fadeIn">
            <div className="p-4 bg-emerald-50 rounded-2xl text-emerald-600 mb-4">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="text-xl font-bold font-display text-slate-900">Terima Kasih!</h2>
            <p className="text-sm text-slate-500 mt-2 max-w-sm">
              Terima kasih telah mengisi buku tamu PST BPS Kabupaten Maros. Anda akan diarahkan kembali ke form dalam beberapa detik.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-6 sm:p-8 space-y-6">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-sky-50 text-sky-600 rounded-2xl shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-bold text-sky-600 uppercase tracking-widest block">Buku Tamu Digital</span>
                <h2 className="text-lg font-bold font-display text-slate-900">PST BPS Kabupaten Maros</h2>
              </div>
            </div>

            <form id="guest-book-form" onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tanggal Kunjungan</label>
                <div className="w-full bg-slate-100 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-slate-500">
                  {todayLabel || '—'} WITA
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nama Pengunjung *</label>
                <input
                  type="text"
                  required
                  value={form.visitorName}
                  onChange={handleChange('visitorName')}
                  placeholder="Nama lengkap"
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Jenis Kelamin *</label>
                <select
                  required
                  value={form.gender}
                  onChange={handleChange('gender')}
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-sky-500 cursor-pointer"
                >
                  <option value="" disabled>-- Pilih Jenis Kelamin --</option>
                  <option value="Laki-laki">Laki-laki</option>
                  <option value="Perempuan">Perempuan</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Pekerjaan Utama *</label>
                <input
                  type="text"
                  required
                  value={form.occupation}
                  onChange={handleChange('occupation')}
                  placeholder="cth. Wiraswasta, PNS, Mahasiswa"
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Instansi *</label>
                <input
                  type="text"
                  required
                  value={form.institution}
                  onChange={handleChange('institution')}
                  placeholder="Nama instansi/perusahaan/lembaga"
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Tujuan Berkunjung *</label>
                <textarea
                  required
                  rows={3}
                  value={form.visitPurpose}
                  onChange={handleChange('visitPurpose')}
                  placeholder="Jelaskan tujuan kunjungan Anda"
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-sky-500 resize-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">E-mail Pengunjung *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={handleChange('email')}
                  placeholder="nama@email.com"
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Nomor WhatsApp *</label>
                <input
                  type="tel"
                  required
                  value={form.whatsappNumber}
                  onChange={handleChange('whatsappNumber')}
                  placeholder="08xxxxxxxxxx"
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-semibold focus:outline-none focus:border-sky-500"
                />
              </div>

              {error && (
                <p className="text-xs font-bold text-red-500 bg-red-50 px-3 py-2 rounded-xl text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-sky-600 hover:bg-sky-700 disabled:opacity-70 text-white font-bold py-3 rounded-xl shadow-lg shadow-sky-600/20 transition duration-150 text-xs cursor-pointer"
              >
                {isSubmitting ? 'Mengirim...' : 'Kirim'}
              </button>
            </form>

            <Link href="/" className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 hover:text-slate-600 transition">
              <ArrowLeft className="w-3.5 h-3.5" />
              Kembali ke Beranda
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
