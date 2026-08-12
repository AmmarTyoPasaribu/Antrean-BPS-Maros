# Antrean BPS Maros

Sistem Antrean & Buku Tamu Digital — Pelayanan Statistik Terpadu (PST) BPS Kabupaten Maros.

## Tech Stack

- **Next.js 15** (App Router) — frontend + backend (API Routes), full deploy di Vercel
- **Supabase** (Postgres + Storage + Realtime) — database, penyimpanan foto petugas, sinkronisasi antar perangkat
- **JWT custom** — autentikasi admin (bukan Supabase Auth)
- **Tailwind CSS 4**

## Fitur

- Ambil nomor antrean mandiri (3 layanan: Statistik, Pengaduan, PPID)
- Layar monitor publik real-time
- Panel Admin: panggil/lewati/selesaikan antrean, riwayat, export CSV
- Kelola Petugas: tambah/hapus/nonaktifkan petugas, upload foto
- Rotasi petugas harian otomatis per loket (berbasis tanggal WITA), bisa diatur manual urutannya
- Buku Tamu digital: form pengunjung, sinkron ke Google Sheets, email terima kasih otomatis

## Setup

1. Install dependencies:
   ```
   npm install
   ```
2. Buat project di [supabase.com](https://supabase.com), lalu jalankan seluruh isi [supabase/schema.sql](supabase/schema.sql) di SQL Editor.
3. Copy `.env.example` jadi `.env.local`, isi semua variabel (lihat komentar di masing-masing baris untuk penjelasan/cara dapatnya):
   - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — dari dashboard Supabase (Settings → API)
   - `JWT_SECRET` — string acak panjang (mis. `openssl rand -base64 48`)
   - `GUEST_BOOK_SHEET_WEBHOOK_URL`, `GUEST_BOOK_SHEET_WEBHOOK_SECRET`, `NEXT_PUBLIC_GUEST_BOOK_SHEET_URL` — untuk integrasi Buku Tamu ke Google Sheets (lihat [scripts/apps-script-guest-book.gs](scripts/apps-script-guest-book.gs))
   - `GMAIL_USER`, `GMAIL_APP_PASSWORD` — untuk kirim email terima kasih buku tamu (App Password Gmail, bukan password login biasa)
4. Jalankan:
   ```
   npm run dev
   ```

Login admin default: username `admin`, password `bpsmaros123` (ganti via SQL kalau perlu, hash-nya di-generate otomatis oleh Postgres saat insert).

## Deploy

Deploy ke [Vercel](https://vercel.com), isi semua environment variable yang sama seperti di `.env.local` pada pengaturan project Vercel.
