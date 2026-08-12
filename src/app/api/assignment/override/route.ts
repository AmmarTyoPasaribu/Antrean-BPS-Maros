import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getWitaDateString } from '@/lib/wita';

// Override manual "siapa bertugas hari ini" untuk satu loket. Dipakai dropdown
// "Pilih Nama Petugas" di Panel Admin — menimpa hasil rotasi/random otomatis
// untuk tanggal WITA berjalan saja.
export async function POST(request: NextRequest) {
  const adminId = await requireAdmin(request);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const serviceId = body?.serviceId;
  const officerId = body?.officerId;
  if (!serviceId || !officerId) {
    return NextResponse.json({ error: 'serviceId dan officerId wajib diisi' }, { status: 400 });
  }

  const today = getWitaDateString();

  const { data: assignment, error } = await supabaseAdmin
    .from('daily_officer_assignment')
    .upsert(
      { service_id: serviceId, assignment_date: today, officer_id: officerId, is_manual_override: true },
      { onConflict: 'service_id,assignment_date' }
    )
    .select()
    .single();

  if (error || !assignment) {
    return NextResponse.json({ error: 'Gagal mengubah petugas' }, { status: 400 });
  }

  return NextResponse.json({ assignment });
}
