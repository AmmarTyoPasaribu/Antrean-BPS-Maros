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
    .select('*')
    .eq('id', queueId)
    .single();

  if (error || !queue) return NextResponse.json({ error: 'Antrean tidak ditemukan' }, { status: 404 });

  await supabaseAdmin.from('history_logs').insert({
    action: `Layanan ${queue.number} dipanggil ulang ke Loket ${queue.loket_number}`,
    service_id: queue.service_id,
    queue_number: queue.number,
  });

  return NextResponse.json({ queue });
}
