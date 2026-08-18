-- ============================================================
-- SISTEM ANTREAN & BUKU TAMU BPS KABUPATEN MAROS
-- Supabase Schema LENGKAP — jalankan SELURUH file ini SEKALI di SQL Editor
-- untuk setup database baru dari nol (termasuk semua perbaikan yang pernah
-- dibuat terpisah sebelumnya — file ini sudah menggantikan semuanya).
--
-- Aman dijalankan ulang (idempotent) di database yang sudah ada isinya —
-- pakai "if not exists" / "on conflict do nothing" / "drop ... if exists"
-- di hampir semua statement, jadi tidak akan menduplikasi atau error kalau
-- dijalankan lebih dari sekali.
-- ============================================================

-- ---------- EXTENSIONS ----------
create extension if not exists pgcrypto;


-- ============================================================
-- 1. TABLES
-- ============================================================

-- Admin (1 akun saja, tidak pakai Supabase Auth)
create table if not exists public.admin (
  id uuid primary key default gen_random_uuid(),
  username text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

-- Layanan / Loket (data tetap: Statistik, Pengaduan, PPID)
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,           -- 'statistik' | 'pengaduan' | 'ppid'
  name text not null,
  code char(1) not null,               -- 'A' | 'B' | 'C'
  loket_number int not null,
  created_at timestamptz not null default now()
);

-- Petugas (master data seluruh pegawai kandidat)
create table if not exists public.officers (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  photo_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Daftar urutan rotasi per loket (BOLEH KOSONG di awal -> sistem pakai random)
create table if not exists public.service_officer_rotation (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  officer_id uuid not null references public.officers(id) on delete cascade,
  order_index int not null,
  unique (service_id, order_index),
  unique (service_id, officer_id)
);

-- Snapshot: petugas bertugas di loket X pada tanggal Y (hasil rotasi/random/override manual).
-- officer_id BOLEH NULL: kalau baris officers-nya dihapus permanen nanti,
-- foreign key otomatis set NULL di sini (bukan ikut terhapus / bukan
-- menolak proses hapus) -- officer_name_snapshot tetap menyimpan namanya
-- supaya riwayat lama tidak pernah hilang/rusak.
create table if not exists public.daily_officer_assignment (
  id uuid primary key default gen_random_uuid(),
  service_id uuid not null references public.services(id) on delete cascade,
  assignment_date date not null,
  officer_id uuid references public.officers(id) on delete set null,
  officer_name_snapshot text,
  is_manual_override boolean not null default false,
  created_at timestamptz not null default now(),
  unique (service_id, assignment_date)
);

-- Counter nomor urut tiket per loket per tanggal (generate nomor tiket atomik, anti race-condition)
create table if not exists public.queue_counters (
  service_id uuid not null references public.services(id) on delete cascade,
  counter_date date not null,
  last_sequence int not null default 0,
  primary key (service_id, counter_date)
);

-- Tiket antrean
create table if not exists public.queues (
  id uuid primary key default gen_random_uuid(),
  number text not null,
  sequence_number int not null,
  service_id uuid not null references public.services(id),
  status text not null check (status in ('waiting','calling','completed','skipped')),
  loket_number int not null,
  created_at timestamptz not null default now(),
  called_at timestamptz,
  completed_at timestamptz,
  queue_date date generated always as ( (created_at at time zone 'Asia/Makassar')::date ) stored
);

create index if not exists idx_queues_service_status on public.queues(service_id, status);
create index if not exists idx_queues_date on public.queues(queue_date);

-- Log histori aksi (disimpan PERMANEN untuk laporan)
create table if not exists public.history_logs (
  id uuid primary key default gen_random_uuid(),
  log_timestamp timestamptz not null default now(),
  action text not null,
  service_id uuid references public.services(id),
  queue_number text not null
);

-- Buku Tamu Digital (pengunjung PST)
create table if not exists public.guest_book_entries (
  id uuid primary key default gen_random_uuid(),
  visit_date date not null,
  visitor_name text not null,
  gender text not null check (gender in ('Laki-laki', 'Perempuan')),
  occupation text not null,
  institution text not null,
  visit_purpose text not null,
  email text not null,
  whatsapp_number text not null,
  synced_to_sheet boolean not null default false,
  email_sent boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_guest_book_visit_date on public.guest_book_entries(visit_date);

-- Survei Kepuasan Pelanggan — SENGAJA TIDAK terhubung ke guest_book_entries
-- (tanpa foreign key / ID pengisi buku tamu). Ini dataset independen: siapa
-- saja yang habis isi buku tamu diarahkan ke halaman survei ini, tapi
-- jawabannya tidak dikaitkan ke identitas siapapun.
create table if not exists public.satisfaction_surveys (
  id uuid primary key default gen_random_uuid(),
  survey_date date not null,
  rating int not null check (rating between 1 and 5),
  liked_text text not null,
  suggestion_text text not null,
  synced_to_sheet boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_satisfaction_surveys_date on public.satisfaction_surveys(survey_date);


-- ============================================================
-- 1b. MIGRASI UNTUK DATABASE YANG SUDAH ADA ISINYA
-- ============================================================
-- Kalau tabel daily_officer_assignment sudah dibuat sebelumnya dengan
-- struktur lama (officer_id NOT NULL, tanpa officer_name_snapshot), baris
-- di atas ("create table if not exists") tidak mengubah struktur yang
-- sudah ada -- makanya perlu ALTER eksplisit berikut. Semua aman
-- dijalankan berkali-kali (idempotent).

alter table public.daily_officer_assignment
  add column if not exists officer_name_snapshot text;

update public.daily_officer_assignment d
set officer_name_snapshot = o.name
from public.officers o
where d.officer_id = o.id
  and d.officer_name_snapshot is null;

alter table public.daily_officer_assignment
  alter column officer_id drop not null;

alter table public.daily_officer_assignment
  drop constraint if exists daily_officer_assignment_officer_id_fkey;

alter table public.daily_officer_assignment
  add constraint daily_officer_assignment_officer_id_fkey
  foreign key (officer_id) references public.officers(id) on delete set null;

-- Trigger: setiap kali officer_id sebuah baris riwayat diisi/diubah,
-- otomatis salin nama petugas saat itu ke officer_name_snapshot. Ini
-- membuat semua jalur tulis (rotasi otomatis, override manual, dst)
-- otomatis konsisten tanpa perlu ubah kode di banyak tempat.
create or replace function public.set_officer_name_snapshot()
returns trigger
language plpgsql
as $$
begin
  if new.officer_id is not null then
    select name into new.officer_name_snapshot from public.officers where id = new.officer_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_set_officer_name_snapshot on public.daily_officer_assignment;
create trigger trg_set_officer_name_snapshot
  before insert or update of officer_id on public.daily_officer_assignment
  for each row execute function public.set_officer_name_snapshot();


-- ============================================================
-- 2. ROW LEVEL SECURITY
-- ============================================================
-- Prinsip: TOLAK SEMUA secara default untuk anon/authenticated.
-- Hanya tabel yang perlu dibaca publik (layar monitor) dapat policy SELECT.
-- Semua tulis-menulis admin lewat service_role di server (Next.js API routes),
-- yang otomatis bypass RLS.

alter table public.admin enable row level security;
-- SENGAJA tanpa policy -> tidak bisa diakses langsung oleh anon/authenticated.
-- Hanya bisa lewat function verify_admin_login() (lihat §3) atau service_role.

alter table public.services enable row level security;
drop policy if exists "services_public_read" on public.services;
create policy "services_public_read" on public.services
  for select to anon, authenticated using (true);

alter table public.officers enable row level security;
drop policy if exists "officers_public_read" on public.officers;
create policy "officers_public_read" on public.officers
  for select to anon, authenticated using (true);

alter table public.service_officer_rotation enable row level security;
-- tanpa policy publik -> hanya service_role (dipakai backend Panel Admin)

alter table public.daily_officer_assignment enable row level security;
drop policy if exists "daily_assignment_public_read" on public.daily_officer_assignment;
create policy "daily_assignment_public_read" on public.daily_officer_assignment
  for select to anon, authenticated using (true);

alter table public.queue_counters enable row level security;
-- tanpa policy publik -> internal saja

alter table public.queues enable row level security;
drop policy if exists "queues_public_read" on public.queues;
create policy "queues_public_read" on public.queues
  for select to anon, authenticated using (true);
-- Tanpa policy insert/update/delete publik: ambil nomor antrean lewat function
-- take_queue() di bawah; aksi admin (panggil/skip/selesai/reset) lewat service_role.

alter table public.history_logs enable row level security;
-- tanpa policy publik -> log internal, dibaca admin lewat service_role saja

alter table public.guest_book_entries enable row level security;
-- tanpa policy publik -> hanya service_role (lewat API route /api/guest-book)
-- yang boleh insert/select. Pengunjung tidak login, jadi tidak ada jalur
-- publik langsung -- validasi & efek samping (Sheets + email) ditangani
-- di server sebelum insert.

alter table public.satisfaction_surveys enable row level security;
-- sama seperti guest_book_entries -- tanpa policy publik, hanya lewat
-- service_role di API route /api/survey.


-- ============================================================
-- 3. FUNCTIONS (RPC)
-- ============================================================

-- A) Cek login admin. Dipanggil dari server Next.js pakai ANON key.
--    Password hash TIDAK PERNAH keluar dari function ini ke pemanggil.
create or replace function public.verify_admin_login(p_username text, p_password text)
returns table(success boolean, admin_id uuid)
language plpgsql
security definer
set search_path = public, extensions -- extensions: tempat pgcrypto (crypt/gen_salt) ter-install di Supabase
as $$
declare
  v_admin record;
begin
  select id, password_hash into v_admin from public.admin where username = p_username;

  if v_admin.id is null then
    return query select false, null::uuid;
    return;
  end if;

  if v_admin.password_hash = crypt(p_password, v_admin.password_hash) then
    return query select true, v_admin.id;
  else
    return query select false, null::uuid;
  end if;
end;
$$;

revoke all on function public.verify_admin_login(text, text) from public;
grant execute on function public.verify_admin_login(text, text) to anon, authenticated;


-- B) Ambil nomor antrean baru (dipanggil publik/visitor lewat ANON key).
--    Nomor urut dihitung atomik lewat queue_counters (aman dari race condition
--    kalau 2 orang klik "Ambil Antrian" bersamaan), dan direset tiap tanggal WITA baru.
create or replace function public.take_queue(p_service_slug text)
returns public.queues
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service record;
  v_today date;
  v_next_seq int;
  v_number text;
  v_new_queue public.queues;
begin
  select id, code, loket_number into v_service from public.services where slug = p_service_slug;
  if v_service.id is null then
    raise exception 'Layanan tidak ditemukan: %', p_service_slug;
  end if;

  v_today := (now() at time zone 'Asia/Makassar')::date;

  insert into public.queue_counters (service_id, counter_date, last_sequence)
  values (v_service.id, v_today, 1)
  on conflict (service_id, counter_date)
  do update set last_sequence = public.queue_counters.last_sequence + 1
  returning last_sequence into v_next_seq;

  v_number := v_service.code || lpad(v_next_seq::text, 3, '0');

  insert into public.queues (number, sequence_number, service_id, status, loket_number)
  values (v_number, v_next_seq, v_service.id, 'waiting', v_service.loket_number)
  returning * into v_new_queue;

  insert into public.history_logs (action, service_id, queue_number)
  values ('Tiket ' || v_number || ' dibuat', v_service.id, v_number);

  return v_new_queue;
end;
$$;

revoke all on function public.take_queue(text) from public;
grant execute on function public.take_queue(text) to anon, authenticated;


-- C) Panggil antrean berikutnya (ADMIN ONLY -> hanya boleh dieksekusi via service_role,
--    dipanggil dari API route setelah JWT admin diverifikasi valid).
--    Otomatis menyelesaikan tiket yang sedang dipanggil sebelumnya (kalau ada).
create or replace function public.call_next_queue(p_service_id uuid)
returns public.queues
language plpgsql
security definer
set search_path = public
as $$
declare
  v_loket int;
  v_active record;
  v_next record;
  v_result public.queues;
begin
  select loket_number into v_loket from public.services where id = p_service_id;
  if v_loket is null then
    raise exception 'Layanan tidak ditemukan';
  end if;

  select * into v_active from public.queues
    where service_id = p_service_id and status = 'calling' limit 1;

  if v_active.id is not null then
    update public.queues set status = 'completed', completed_at = now() where id = v_active.id;
    insert into public.history_logs(action, service_id, queue_number)
      values ('Layanan ' || v_active.number || ' selesai dilayani di Loket ' || v_loket, p_service_id, v_active.number);
  end if;

  select * into v_next from public.queues
    where service_id = p_service_id and status = 'waiting'
    order by sequence_number asc limit 1;

  if v_next.id is null then
    raise exception 'Tidak ada antrean menunggu untuk layanan ini';
  end if;

  update public.queues set status = 'calling', called_at = now()
    where id = v_next.id returning * into v_result;

  insert into public.history_logs(action, service_id, queue_number)
    values ('Layanan ' || v_next.number || ' dipanggil ke Loket ' || v_loket, p_service_id, v_next.number);

  return v_result;
end;
$$;

revoke all on function public.call_next_queue(uuid) from public;
grant execute on function public.call_next_queue(uuid) to service_role;


-- D) Pastikan tanggal WITA hari ini sudah punya petugas untuk tiap loket.
--    Dipanggil server-side (service_role) di awal request Next.js.
--    Prioritas: pakai daftar rotasi (service_officer_rotation) kalau sudah diisi,
--    kalau masih kosong -> pilih RANDOM dari petugas aktif (tidak duplikat antar loket).
--    Idempotent: kalau assignment hari itu sudah ada / sudah di-override manual, dibiarkan.
create or replace function public.ensure_daily_assignment(p_date date default (now() at time zone 'Asia/Makassar')::date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_service record;
  v_officer_id uuid;
  v_rotation_count int;
  v_used_officers uuid[] := '{}';
begin
  for v_service in select id from public.services order by loket_number loop

    if exists (
      select 1 from public.daily_officer_assignment
      where service_id = v_service.id and assignment_date = p_date
    ) then
      select officer_id into v_officer_id from public.daily_officer_assignment
        where service_id = v_service.id and assignment_date = p_date;
      if v_officer_id is not null then
        v_used_officers := array_append(v_used_officers, v_officer_id);
      end if;
      continue;
    end if;

    select count(*) into v_rotation_count
      from public.service_officer_rotation where service_id = v_service.id;

    v_officer_id := null;

    if v_rotation_count > 0 then
      select officer_id into v_officer_id
        from public.service_officer_rotation
        where service_id = v_service.id
        order by order_index asc
        offset ( (p_date - date '2026-01-01')::int % v_rotation_count )
        limit 1;
    end if;

    if v_officer_id is null then
      select id into v_officer_id
        from public.officers
        where is_active = true
          and (array_length(v_used_officers,1) is null or id <> all(v_used_officers))
        order by random()
        limit 1;
    end if;

    if v_officer_id is not null then
      insert into public.daily_officer_assignment (service_id, assignment_date, officer_id, is_manual_override)
      values (v_service.id, p_date, v_officer_id, false)
      on conflict (service_id, assignment_date) do nothing;

      v_used_officers := array_append(v_used_officers, v_officer_id);
    end if;

  end loop;
end;
$$;

revoke all on function public.ensure_daily_assignment(date) from public;
grant execute on function public.ensure_daily_assignment(date) to service_role;


-- ============================================================
-- 3b. REALTIME
-- ============================================================
-- Publication "supabase_realtime" ada by default tapi KOSONG -- tabel harus
-- didaftarkan eksplisit supaya postgres_changes (dipakai layar monitor untuk
-- update otomatis lintas perangkat) benar-benar mengirim event.
-- Dibungkus DO block + cek pg_publication_tables karena "ALTER PUBLICATION
-- ... ADD TABLE" akan ERROR (bukan no-op) kalau tabelnya sudah terdaftar --
-- ini yang membuat seluruh file aman dijalankan berkali-kali.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'queues'
  ) then
    alter publication supabase_realtime add table public.queues;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'daily_officer_assignment'
  ) then
    alter publication supabase_realtime add table public.daily_officer_assignment;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'officers'
  ) then
    alter publication supabase_realtime add table public.officers;
  end if;
end $$;


-- ============================================================
-- 4. STORAGE (foto petugas)
-- ============================================================
insert into storage.buckets (id, name, public)
values ('officer-photos', 'officer-photos', true)
on conflict (id) do nothing;

drop policy if exists "officer_photos_public_read" on storage.objects;
create policy "officer_photos_public_read"
on storage.objects for select
to public
using (bucket_id = 'officer-photos');
-- Upload/update/delete file TIDAK dibuka untuk publik -> hanya lewat service_role
-- di API route Panel Admin (setelah verifikasi JWT admin).


-- ============================================================
-- 5. SEED DATA
-- ============================================================

-- Akun admin — password di-hash LANGSUNG oleh Postgres saat insert, tidak pernah
-- tersimpan/terlihat sebagai plain text di database.
insert into public.admin (username, password_hash)
values ('admin', crypt('bpsmaros123', gen_salt('bf')))
on conflict (username) do nothing;

-- 3 layanan tetap
insert into public.services (slug, name, code, loket_number) values
  ('statistik', 'Pelayanan Statistik', 'A', 1),
  ('pengaduan', 'Pelayanan Pengaduan', 'B', 2),
  ('ppid', 'Pelayanan PPID', 'C', 3)
on conflict (slug) do nothing;

-- Master data 32 petugas (dipindah dari AVAILABLE_OFFICERS di kode lama).
-- photo_url masih NULL -> upload fotonya lewat Panel Admin setelah migrasi jalan.
insert into public.officers (slug, name) values
  ('wahyu', 'Wahyu Kiswatiningsih, SST'),
  ('firman', 'Andi Firmansyah, S.Sos.'),
  ('sudirman', 'Sudirman, SE, M.Si'),
  ('nita', 'Nuranita Hasairin, SST'),
  ('arifin', 'Muhammad Arifin Umar, SE'),
  ('sakka', 'Sakka, SE'),
  ('yanti', 'Ir. Sri Harjanti'),
  ('arfah', 'Arfah, SE'),
  ('siabe', 'Siabe, SE.'),
  ('hikma', 'Hikmayani, SST'),
  ('kartini', 'Kartini, S.Si., M.Stat.'),
  ('dewi', 'Andi Dewi, S.Si'),
  ('mustafa', 'Mustafa, S.E.'),
  ('gusmawan', 'Gusmawan, S.E.'),
  ('fauziah', 'Fauziah Lestari, SST, M.Sc.'),
  ('annur', 'Annur Rachmih, SST'),
  ('herlina', 'Herlina, SE'),
  ('shima', 'Shima Regyarni, S.Si.'),
  ('dila', 'Anindya Deshinta Dila, S.Tr.Stat.'),
  ('kristin', 'Kristin Tondok, S.E.'),
  ('sija', 'Syarifuddin, SE.'),
  ('faishal', 'Faishal Abdurrazzaq, S.Tr.Stat.'),
  ('farida', 'Farida Jumlia Ningsih, A.Md.'),
  ('chory', 'Chory Ayu Zulfaida, S.Tr.Stat.'),
  ('ambri', 'Ambri, A.Md'),
  ('numan', 'Muhammad Nu''Man, SHI.'),
  ('saharuddin', 'Saharuddin, S.E.'),
  ('syarifuddin', 'Syarifuddin, S.Sos'),
  ('nasrullah', 'Nasrullah, S.Sos.'),
  ('qalbi', 'Nur Qalbi. Mr, A.Md.Stat.'),
  ('achil', 'Andi Awaluddin, ST'),
  ('rafiqah', 'Andi Rafiqah Kemala Rani, A.Md.Ak.'),
  ('darmansyah', 'Darmansyah')
on conflict (slug) do nothing;

-- Assignment hari pertama, disamakan dengan tampilan default aplikasi lama
-- (Statistik->Wahyu, Pengaduan->Andi Firmansyah, PPID->Sudirman), ditandai manual
-- override supaya tidak langsung ditimpa random oleh ensure_daily_assignment().
insert into public.daily_officer_assignment (service_id, assignment_date, officer_id, is_manual_override)
select s.id, (now() at time zone 'Asia/Makassar')::date, o.id, true
from public.services s
join public.officers o on (
  (s.slug = 'statistik' and o.slug = 'wahyu') or
  (s.slug = 'pengaduan' and o.slug = 'firman') or
  (s.slug = 'ppid' and o.slug = 'sudirman')
)
on conflict (service_id, assignment_date) do nothing;


-- ============================================================
-- SELESAI. Verifikasi cepat setelah run:
--   select * from public.services;
--   select * from public.officers limit 5;
--   select * from public.daily_officer_assignment;
--   select * from public.verify_admin_login('admin', 'bpsmaros123');  -- harus (true, <uuid>)
--   select officer_id, officer_name_snapshot from public.daily_officer_assignment limit 5;
--   select * from public.guest_book_entries limit 1;
-- ============================================================
