import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getWitaDateString } from '@/lib/wita';

export async function POST(request: NextRequest) {
  const adminId = await requireAdmin(request);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const queueId = body?.queueId;
  if (!queueId) return NextResponse.json({ error: 'queueId wajib diisi' }, { status: 400 });

  const { data: queue, error } = await supabaseAdmin
    .from('queues')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', queueId)
    .select()
    .single();

  if (error || !queue) return NextResponse.json({ error: 'Gagal menyelesaikan antrean' }, { status: 400 });

  const today = getWitaDateString();
  const { data: assignment } = await supabaseAdmin
    .from('daily_officer_assignment')
    .select('officer_id, officer_name_snapshot')
    .eq('service_id', queue.service_id)
    .eq('assignment_date', today)
    .maybeSingle();

  // Prefer nama snapshot dulu (aman walau petugasnya sudah dihapus dari
  // tabel officers), lalu coba nama live kalau officer_id masih valid.
  let officerName = assignment?.officer_name_snapshot || 'Petugas';
  if (assignment?.officer_id) {
    const { data: officer } = await supabaseAdmin
      .from('officers')
      .select('name')
      .eq('id', assignment.officer_id)
      .maybeSingle();
    if (officer?.name) officerName = officer.name;
  }

  await supabaseAdmin.from('history_logs').insert({
    action: `Layanan ${queue.number} diselesaikan oleh ${officerName}`,
    service_id: queue.service_id,
    queue_number: queue.number,
  });

  return NextResponse.json({ queue });
}
