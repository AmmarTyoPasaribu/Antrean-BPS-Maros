# PRD: Migrasi Sistem Antrean BPS Maros ke Next.js + Supabase

**Status:** Draft untuk direview
**Tanggal:** 2026-08-12
**Project Supabase:** `kodnrbthhbeeqtwdigos`

---

## 1. Latar Belakang

Aplikasi antrean BPS Kabupaten Maros saat ini adalah React + Vite murni client-side — seluruh data (antrean, petugas, log histori, sesi login admin) tersimpan di `localStorage` browser. Ini berarti:

- Data hilang jika browser di-clear atau ganti perangkat
- Layar monitor publik dan panel admin **tidak bisa terpisah perangkat** (semua state hidup di satu tab browser)
- Tidak ada histori jangka panjang untuk laporan
- Penggantian petugas harian dilakukan manual oleh admin tiap hari

Migrasi ini mengganti fondasi teknis aplikasi menjadi Next.js + Supabase, **tanpa mengubah tampilan (UI/UX/tema) sedikit pun** — hasil akhir harus terlihat identik dengan versi saat ini.

## 2. Tujuan

1. Pindahkan seluruh penyimpanan data dari `localStorage` ke **Supabase Postgres**.
2. Frontend + backend jadi satu aplikasi **Next.js**, deploy penuh di **Vercel** (tidak ada server terpisah).
3. Autentikasi admin pakai **JWT custom** (bukan Supabase Auth), 1 akun admin saja.
4. Panel admin bisa **tambah/kelola petugas beserta foto** (upload ke Supabase Storage).
5. **Rotasi petugas otomatis** per loket setiap hari jam 00:00 WITA, tanpa perlu admin pilih manual tiap hari (tapi tetap bisa di-override).
6. Layar monitor publik dan panel admin bisa jalan di **perangkat berbeda** dan tetap sinkron real-time.
7. **UI/UX/tema sama persis** — tidak ada perubahan visual, hanya penggantian sumber data.

## 3. Cakupan (Scope)

**Termasuk:**
- Migrasi komponen React (App, VisitorMonitor, AdminPanel) ke Next.js App Router — markup & styling dipertahankan 1:1.
- Skema database Supabase lengkap (akan diberikan sebagai SQL terpisah, dijalankan manual oleh Anda).
- API routes Next.js untuk semua operasi tulis (ambil antrian, panggil, skip, selesaikan, reset, kelola petugas, rotasi, login).
- Sistem login JWT dengan cookie httpOnly.
- Upload & kelola foto petugas via Supabase Storage.
- Rotasi otomatis petugas per loket berbasis tanggal WITA.
- Sinkronisasi real-time via Supabase Realtime (monitor publik update otomatis saat admin melakukan aksi).
- Histori antrean & log disimpan permanen.

**Tidak termasuk (out of scope untuk fase ini):**
- Multi-admin / role-based access (tetap 1 akun admin).
- Fitur ubah password admin lewat UI (password diubah manual lewat SQL jika perlu).
- Notifikasi (SMS/WA/email) ke pengunjung.
- Native mobile app.

## 4. Arsitektur Target

```
┌─────────────────────────────────────────────┐
│                 Vercel (hosting)              │
│  ┌─────────────────────────────────────────┐ │
│  │           Next.js App (App Router)        │ │
│  │  - Halaman: / (visitor + admin toggle)    │ │
│  │  - API Routes (Route Handlers):           │ │
│  │    /api/auth/login, /api/queues,          │ │
│  │    /api/officers, /api/rotation, dst.     │ │
│  └───────────────┬───────────────────────────┘ │
└──────────────────┼───────────────────────────┘
                    │  (service role key, server-only)
                    ▼
┌─────────────────────────────────────────────┐
│                  Supabase                     │
│  - Postgres (tables: admin, officers,         │
│    services, service_officer_rotation,        │
│    daily_officer_assignment, queues,          │
│    history_logs)                              │
│  - Storage (bucket: officer-photos)           │
│  - Realtime (broadcast perubahan queues)      │
└─────────────────────────────────────────────┘
```

**Kenapa Next.js:** satu-satunya framework yang memenuhi syarat "frontend + backend, full hosting di Vercel" tanpa server terpisah — API Routes-nya jalan sebagai serverless functions di Vercel, jadi tidak perlu Express/hosting backend sendiri (`express` di `package.json` saat ini memang tidak dipakai — akan dihapus total di migrasi ini).

## 5. Model Data (Ringkasan)

| Tabel | Fungsi |
|---|---|
| `admin` | 1 baris: username + password hash (bcrypt). Diakses lewat RPC khusus, bukan query langsung. |
| `officers` | Master data petugas: nama, gelar, foto (URL Supabase Storage), status aktif. |
| `services` | 3 layanan tetap (Statistik/A, Pengaduan/B, PPID/C) dengan kode & nomor loket. |
| `service_officer_rotation` | Daftar urutan rotasi petugas per loket (mis. Loket 1 → [Wahyu, Sudirman, Arifin, ...]). |
| `daily_officer_assignment` | Snapshot "siapa bertugas di loket X pada tanggal Y" — hasil rotasi otomatis, bisa di-override admin. |
| `queues` | Tiket antrean: nomor, layanan, status, timestamp. Sequence number dihitung ulang dari 001 tiap hari (lihat §6.4). |
| `history_logs` | Log aksi (cetak tiket, panggil, selesai, dll), disimpan permanen. |

SQL DDL lengkap (`CREATE TABLE`, RLS policies, functions) akan saya berikan sebagai file terpisah setelah PRD ini disetujui — tinggal Anda jalankan di SQL Editor Supabase.

## 6. Fitur & Alur Detail

### 6.1 Autentikasi Admin (JWT custom)
- Tabel `admin` di-seed lewat SQL dengan 1 baris: `username = admin`, password **di-hash pakai bcrypt** (bukan disimpan plain text) — saya generate hash-nya dan sertakan di SQL.
- RLS pada tabel `admin` **menolak semua akses langsung** (deny-all). Pengecekan login dilakukan lewat **Postgres RPC function** (`SECURITY DEFINER`) yang menerima username+password, membandingkan hash secara internal, dan hanya mengembalikan `true/false` — password hash tidak pernah terekspos ke aplikasi. Ini sesuai permintaan Anda: tidak perlu service role untuk proses login itu sendiri.
- Jika valid → server (API route) menerbitkan **JWT** ditandatangani dengan `JWT_SECRET` (env var Vercel), disimpan di **cookie httpOnly** (bukan localStorage, supaya aman dari XSS).
- Semua endpoint admin-only memverifikasi JWT dari cookie sebelum mengeksekusi aksi.

> **Catatan teknis (flag untuk konfirmasi Anda):** Untuk operasi tulis admin lainnya (panggil antrean, kelola petugas, dll — bukan proses login), API route akan menggunakan **service role key** di sisi server (tidak pernah dikirim ke browser), setelah JWT admin diverifikasi valid. Ini pola standar & aman untuk backend Next.js. Permintaan "tanpa service role" saya terapkan secara ketat khusus untuk *pengecekan login* sesuai konteks kalimat Anda. Jika Anda maunya literally **zero** pemakaian service role di seluruh sistem (termasuk untuk operasi tulis lain), beri tahu saya — alternatifnya pakai RLS publik yang lebih terbuka (kurang ketat, tapi tidak butuh service role).

### 6.2 Ambil Antrean (Publik)
- Sama seperti sekarang: pilih layanan → klik "Ambil Antrian Baru" → dapat nomor (A001, dst).
- Insert langsung ke tabel `queues` (RLS mengizinkan publik INSERT, tidak perlu login).

### 6.3 Panel Admin — Kontrol Loket
- Panggil Selanjutnya / Panggil Ulang / Lewati / Selesaikan — sama seperti sekarang, tapi jadi mutasi ke Supabase lewat API route admin-only.
- Perubahan status **langsung ter-broadcast** ke layar monitor publik lewat Supabase Realtime (tanpa refresh manual) — sesuai jawaban Anda soal sinkronisasi perangkat terpisah.

### 6.4 Nomor Urut Antrean — Reset Harian
- Karena histori sekarang disimpan **permanen**, nomor urut (A001, A002, ...) dihitung ulang dari 001 **berdasarkan tanggal berjalan (WITA)**, bukan dari seluruh histori. Ini penyesuaian penting dibanding kode lama (yang menghitung sequence dari semua data tersimpan tanpa filter tanggal).
- "Reset Hari Ini" di admin akan menandai antrean aktif hari itu selesai/dibatalkan, tapi histori & log tetap tersimpan permanen di database untuk laporan.

### 6.5 Kelola Petugas (Baru)
- Panel Admin dapat tab/section baru: **Tambah Petugas** — form nama, gelar, upload foto.
- Foto di-upload ke bucket Supabase Storage `officer-photos` (publik-read), URL hasil upload disimpan di kolom `officers.photo_url`.
- Petugas yang sudah ada bisa diedit/dinonaktifkan (bukan dihapus permanen, supaya histori lama tetap valid — pakai flag `is_active`).

### 6.6 Rotasi Otomatis Petugas per Loket
- **Untuk fase awal:** belum ada daftar urutan rotasi yang ditetapkan, jadi sistem memilih petugas **secara acak** dari pool petugas aktif (`officers` dengan `is_active = true`) untuk tiap loket setiap hari baru (dihindarkan duplikat — 1 orang tidak dipilih untuk 2 loket sekaligus di hari yang sama).
- Tabel `service_officer_rotation` (daftar urutan per loket) tetap dibuat di skema sejak awal tapi **boleh kosong**. Kapan pun nanti Anda isi daftar urutan untuk sebuah loket, sistem otomatis beralih dari "acak" ke "urut sesuai daftar" untuk loket itu — tanpa perlu ubah kode/struktur database lagi.
- **Mekanisme:** dihitung **on-demand** saat request pertama pada hari itu (self-healing, tidak bergantung cron job yang bisa gagal/telat) — begitu ada yang membuka aplikasi setelah jam 00:00 WITA, sistem cek "sudah ada assignment untuk hari ini di `daily_officer_assignment`?" Jika belum, generate otomatis (acak atau sesuai rotasi, tergantung apakah daftar rotasi loket itu terisi) lalu simpan (snapshot permanen untuk histori). Jika admin melakukan override manual untuk hari itu, override tersebut yang dipakai (tidak ditimpa ulang).
- Dropdown "Pilih Nama Petugas" di admin panel tetap ada, berfungsi sebagai **override manual untuk hari ini saja** (default terisi otomatis — acak untuk sekarang, sesuai rotasi nanti kalau sudah diatur).

### 6.7 Layar Monitor Publik
- Sama persis secara visual, datanya sekarang dari Supabase (via Realtime subscription), bisa dibuka di device/browser terpisah dari admin (misal TV di lobi).

## 7. Non-Functional Requirements

- **Zero perubahan visual**: semua className Tailwind, struktur JSX, copy teks Bahasa Indonesia dipertahankan identik.
- **Biaya tetap Rp0**: Vercel Hobby (gratis) + Supabase Free tier (Postgres 500MB, Storage 1GB, Realtime included) — cukup jauh untuk skala kantor BPS Kabupaten.
- **Keamanan**: password admin di-hash (bcrypt), JWT di httpOnly cookie, RLS aktif di semua tabel, service role key hanya di server env (tidak pernah ke client).
- **Resiliens**: rotasi petugas self-healing (tidak bergantung cron eksternal), realtime punya fallback polling jika koneksi websocket putus.

## 8. Environment Variables (Vercel)

| Variable | Keterangan |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://kodnrbthhbeeqtwdigos.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon key (sudah Anda berikan) — dipakai client-side untuk read realtime & insert antrean publik |
| `SUPABASE_SERVICE_ROLE_KEY` | **server-only**, untuk API routes admin — Anda ambil dari dashboard Supabase → Settings → API |
| `JWT_SECRET` | string acak panjang, saya generate-kan saat implementasi |

> ⚠️ Anon key yang Anda kirim di chat ini aman untuk dipakai di frontend (memang didesain publik), tapi **service role key JANGAN pernah dikirim di chat/commit ke git** — nanti diambil langsung dari dashboard Supabase dan diisi sebagai env var di Vercel saja.

## 9. Rencana Kerja (High-Level)

1. **SQL Schema** — saya berikan file `.sql` lengkap (tabel, RLS, RPC login, seed data awal termasuk hash password admin) untuk Anda jalankan manual di Supabase SQL Editor.
2. **Setup project Next.js** — scaffold baru, port Tailwind config & font, pasang `@supabase/supabase-js`.
3. **Migrasi komponen UI** — App/VisitorMonitor/AdminPanel dipindah ke Next.js, ganti sumber data dari `useState+localStorage` ke Supabase queries/mutations, styling & markup dijaga identik.
4. **API Routes** — auth login, queues CRUD, officers CRUD + upload foto, rotation management.
5. **Realtime wiring** — subscribe perubahan `queues` untuk update monitor otomatis.
6. **Rotasi otomatis** — implementasi logic on-demand generation.
7. **Testing end-to-end** — jalankan lokal, verifikasi semua alur sama seperti versi lama (visual diff).
8. **Deploy ke Vercel** — sambungkan project, isi env vars, deploy.

## 10. Keputusan yang Sudah Dikonfirmasi

| Topik | Keputusan |
|---|---|
| Penyimpanan foto | Supabase Storage |
| Logika rotasi | **Acak dulu** dari pool petugas aktif (belum ada daftar urutan), admin override manual kapan saja. Struktur database sudah siap untuk beralih ke daftar rotasi terurut per loket kapan pun tanpa migrasi ulang. |
| Sinkronisasi | Real-time via Supabase Realtime (device terpisah) |
| Retensi data | Permanen (dengan penyesuaian nomor urut reset harian, lihat §6.4) |
| Durasi sesi login admin | JWT berlaku 7 hari, cookie httpOnly |
| Service role key | Dipakai di server (API routes) untuk operasi admin selain login (lihat §6.1) — bukan untuk pengecekan login, yang tetap pakai RLS deny-all + RPC function |

## 11. Hal yang Masih Perlu Konfirmasi Anda

Tidak ada lagi item terbuka — semua keputusan arsitektur sudah final per tabel di atas.

Setelah PRD ini Anda setujui (dengan/tanpa revisi lagi), saya lanjut buatkan **SQL schema lengkap** untuk dijalankan manual di Supabase.
