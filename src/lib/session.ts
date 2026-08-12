import 'server-only';
import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAdminToken } from './jwt';

export const SESSION_COOKIE = 'antrean_admin_session';
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 hari

// Returns the admin id if the request carries a valid session cookie, else null.
// Use at the top of every admin-only API route (Route Handlers) before touching supabaseAdmin.
export async function requireAdmin(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const verified = await verifyAdminToken(token);
  return verified ? verified.adminId : null;
}

// Same check, for use in Server Components (e.g. the initial page.tsx load)
// where there is no NextRequest, only the ambient cookie store.
export async function getAdminFromCookieStore(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const verified = await verifyAdminToken(token);
  return verified ? verified.adminId : null;
}
