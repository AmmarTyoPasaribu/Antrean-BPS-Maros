import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const adminId = await requireAdmin(request);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const queueId = body?.queueId;
  if (!queueId) return NextResponse.json({ error: 'queueId wajib diisi' }, { status: 400 });

  const { data: queue, error } = await supabaseAdmin
    .from('queues')
    .update({ status: 'skipped', completed_at: new Date().toISOString() })
    .eq('id', queueId)
    .select()
    .single();

  if (error || !queue) return NextResponse.json({ error: 'Gagal melewati antrean' }, { status: 400 });

  await supabaseAdmin.from('history_logs').insert({
    action: `Layanan ${queue.number} dilewati (tidak hadir) di Loket ${queue.loket_number}`,
    service_id: queue.service_id,
    queue_number: queue.number,
  });

  return NextResponse.json({ queue });
}
