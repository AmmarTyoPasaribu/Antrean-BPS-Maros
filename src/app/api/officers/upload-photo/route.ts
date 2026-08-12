import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

const MAX_SIZE_BYTES = 3 * 1024 * 1024; // 3MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export async function POST(request: NextRequest) {
  const adminId = await requireAdmin(request);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const officerId = formData?.get('officerId');

  if (!(file instanceof File) || typeof officerId !== 'string' || !officerId) {
    return NextResponse.json({ error: 'File dan officerId wajib diisi' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Format foto harus JPG, PNG, atau WebP' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Ukuran foto maksimal 3MB' }, { status: 400 });
  }

  // Ambil photo_url lama dulu (untuk dihapus setelah upload baru berhasil).
  const { data: existingOfficer } = await supabaseAdmin
    .from('officers')
    .select('photo_url')
    .eq('id', officerId)
    .maybeSingle();
  const oldPhotoUrl = existingOfficer?.photo_url ?? null;

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${officerId}-${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabaseAdmin.storage
    .from('officer-photos')
    .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return NextResponse.json({ error: 'Gagal mengunggah foto' }, { status: 400 });
  }

  const { data: publicUrlData } = supabaseAdmin.storage.from('officer-photos').getPublicUrl(path);

  const { data: officer, error: updateError } = await supabaseAdmin
    .from('officers')
    .update({ photo_url: publicUrlData.publicUrl })
    .eq('id', officerId)
    .select()
    .single();

  if (updateError || !officer) {
    return NextResponse.json({ error: 'Gagal menyimpan URL foto' }, { status: 400 });
  }

  // Bersihkan foto lama dari storage supaya tidak menumpuk jadi sampah.
  // Best-effort — kalau gagal, tidak menggagalkan response (foto baru sudah aktif).
  const oldPath = extractStoragePath(oldPhotoUrl);
  if (oldPath && oldPath !== path) {
    const { error: removeError } = await supabaseAdmin.storage.from('officer-photos').remove([oldPath]);
    if (removeError) console.error('Gagal menghapus foto lama:', removeError);
  }

  return NextResponse.json({ officer });
}

function extractStoragePath(publicUrl: string | null): string | null {
  if (!publicUrl) return null;
  const marker = '/officer-photos/';
  const index = publicUrl.indexOf(marker);
  if (index === -1) return null;
  return publicUrl.slice(index + marker.length);
}
