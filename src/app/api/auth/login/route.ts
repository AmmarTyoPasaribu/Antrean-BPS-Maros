import { NextRequest, NextResponse } from 'next/server';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { signAdminToken } from '@/lib/jwt';
import { SESSION_COOKIE, SESSION_MAX_AGE_SECONDS } from '@/lib/session';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === 'string' ? body.username : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!username || !password) {
    return NextResponse.json({ error: 'Username dan Password wajib diisi' }, { status: 400 });
  }

  const { data, error } = await supabaseBrowser.rpc('verify_admin_login', {
    p_username: username,
    p_password: password,
  });

  const result = Array.isArray(data) ? data[0] : null;

  if (error || !result?.success) {
    return NextResponse.json({ error: 'Username atau Password salah!' }, { status: 401 });
  }

  const token = await signAdminToken(result.admin_id as string);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
