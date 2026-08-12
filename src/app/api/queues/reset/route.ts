import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getWitaDateString } from '@/lib/wita';

// "Reset Hari Ini": tandai semua tiket yang masih waiting/calling hari ini
// sebagai skipped. Histori (completed/skipped) TIDAK dihapus — permanen.
export async function POST(request: NextRequest) {
  const adminId = await requireAdmin(request);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const today = getWitaDateString();

  const { error } = await supabaseAdmin
    .from('queues')
    .update({ status: 'skipped', completed_at: new Date().toISOString() })
    .eq('queue_date', today)
    .in('status', ['waiting', 'calling']);

  if (error) return NextResponse.json({ error: 'Gagal mereset antrean' }, { status: 400 });

  await supabaseAdmin.from('history_logs').insert({
    action: 'Sistem antrian di-reset ulang oleh operator',
    service_id: null,
    queue_number: 'RESET',
  });

  return NextResponse.json({ ok: true });
}
