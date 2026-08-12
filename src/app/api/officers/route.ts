import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';
import { supabaseAdmin } from '@/lib/supabase-admin';

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40) || 'petugas'
  );
}

export async function POST(request: NextRequest) {
  const adminId = await requireAdmin(request);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  if (!name) return NextResponse.json({ error: 'Nama wajib diisi' }, { status: 400 });

  const baseSlug = slugify(name);
  let slug = baseSlug;
  let suffix = 1;
  for (;;) {
    const { data: existing } = await supabaseAdmin
      .from('officers')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!existing) break;
    suffix += 1;
    slug = `${baseSlug}-${suffix}`;
  }

  const { data: officer, error } = await supabaseAdmin
    .from('officers')
    .insert({ name, slug, photo_url: null, is_active: true })
    .select()
    .single();

  if (error || !officer) {
    return NextResponse.json({ error: 'Gagal menambahkan petugas' }, { status: 400 });
  }

  return NextResponse.json({ officer });
}
