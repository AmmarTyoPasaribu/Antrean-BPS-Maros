import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

// GET /api/rotation?serviceId=... -> daftar urutan rotasi petugas untuk satu loket
export async function GET(request: NextRequest) {
  const adminId = await requireAdmin(request);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const serviceId = request.nextUrl.searchParams.get('serviceId');
  if (!serviceId) return NextResponse.json({ error: 'serviceId wajib diisi' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('service_officer_rotation')
    .select('officer_id, order_index, officers(id, name, photo_url)')
    .eq('service_id', serviceId)
    .order('order_index', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ rotation: data ?? [] });
}

// POST /api/rotation { serviceId, officerIds: string[] } -> ganti seluruh urutan
// rotasi loket tsb sekaligus (hapus lalu tulis ulang, urutan = posisi di array).
// officerIds boleh array kosong untuk mengosongkan rotasi (balik ke mode acak).
export async function POST(request: NextRequest) {
  const adminId = await requireAdmin(request);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const serviceId = body?.serviceId;
  const officerIds = Array.isArray(body?.officerIds) ? (body.officerIds as string[]) : null;
  if (!serviceId || !officerIds) {
    return NextResponse.json({ error: 'serviceId dan officerIds wajib diisi' }, { status: 400 });
  }

  const { error: deleteError } = await supabaseAdmin
    .from('service_officer_rotation')
    .delete()
    .eq('service_id', serviceId);

  if (deleteError) return NextResponse.json({ error: deleteError.message }, { status: 400 });

  if (officerIds.length > 0) {
    const rows = officerIds.map((officerId, index) => ({
      service_id: serviceId,
      officer_id: officerId,
      order_index: index,
    }));
    const { error: insertError } = await supabaseAdmin.from('service_officer_rotation').insert(rows);
    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
