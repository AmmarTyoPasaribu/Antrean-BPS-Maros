import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin(request);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await request.json().catch(() => null);

  const updates: Record<string, unknown> = {};
  if (typeof body?.name === 'string' && body.name.trim()) updates.name = body.name.trim();
  if (typeof body?.is_active === 'boolean') updates.is_active = body.is_active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Tidak ada perubahan yang dikirim' }, { status: 400 });
  }

  // Menonaktifkan hanya boleh kalau petugas ini sudah tidak ada di daftar
  // rotasi loket manapun — kalau masih ada, giliran rotasinya tetap akan
  // jalan meski statusnya nonaktif, jadi harus dikeluarkan dulu dari rotasi.
  if (updates.is_active === false) {
    const { count: rotationCount } = await supabaseAdmin
      .from('service_officer_rotation')
      .select('id', { count: 'exact', head: true })
      .eq('officer_id', id);

    if ((rotationCount ?? 0) > 0) {
      return NextResponse.json(
        { error: 'Petugas ini masih ada di daftar rotasi. Keluarkan dulu dari rotasi sebelum menonaktifkan.' },
        { status: 409 }
      );
    }
  }

  const { data: officer, error } = await supabaseAdmin
    .from('officers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error || !officer) {
    return NextResponse.json({ error: 'Gagal mengubah data petugas' }, { status: 400 });
  }

  return NextResponse.json({ officer });
}

// Hapus permanen. Petugas TETAP bisa dihapus walau punya riwayat penugasan
// lama (daily_officer_assignment) — riwayat itu tidak rusak karena
// officer_id di baris riwayat otomatis jadi NULL (ON DELETE SET NULL) dan
// namanya sudah "di-snapshot" ke kolom officer_name_snapshot lewat trigger
// database (lihat supabase/fix-officer-deletion-and-history.sql).
//
// Yang TETAP diblokir: petugas yang masih terdaftar di daftar rotasi
// (service_officer_rotation) loket manapun — harus dikeluarkan dari rotasi
// dulu, karena kalau dihapus langsung, urutan rotasi loket itu jadi bolong.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const adminId = await requireAdmin(request);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const { count: rotationCount } = await supabaseAdmin
    .from('service_officer_rotation')
    .select('id', { count: 'exact', head: true })
    .eq('officer_id', id);

  if ((rotationCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'Petugas ini masih ada di daftar rotasi. Keluarkan dulu dari rotasi sebelum menghapus.' },
      { status: 409 }
    );
  }

  const { data: officer } = await supabaseAdmin.from('officers').select('photo_url').eq('id', id).maybeSingle();

  const { error: deleteError } = await supabaseAdmin.from('officers').delete().eq('id', id);
  if (deleteError) {
    return NextResponse.json({ error: 'Gagal menghapus petugas' }, { status: 400 });
  }

  const photoPath = extractStoragePath(officer?.photo_url ?? null);
  if (photoPath) {
    const { error: removeError } = await supabaseAdmin.storage.from('officer-photos').remove([photoPath]);
    if (removeError) console.error('Gagal menghapus foto petugas yang dihapus:', removeError);
  }

  return NextResponse.json({ ok: true });
}

function extractStoragePath(publicUrl: string | null): string | null {
  if (!publicUrl) return null;
  const marker = '/officer-photos/';
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return publicUrl.slice(index + marker.length);
}
