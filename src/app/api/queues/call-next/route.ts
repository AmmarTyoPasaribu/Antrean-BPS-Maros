import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(request: NextRequest) {
  const adminId = await requireAdmin(request);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const serviceId = body?.serviceId;
  if (!serviceId) return NextResponse.json({ error: 'serviceId wajib diisi' }, { status: 400 });

  const { data, error } = await supabaseAdmin.rpc('call_next_queue', { p_service_id: serviceId });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ queue: data });
}
