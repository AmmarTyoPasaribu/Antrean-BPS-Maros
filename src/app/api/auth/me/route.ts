import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/session';

export async function GET(request: NextRequest) {
  const adminId = await requireAdmin(request);
  return NextResponse.json({ isAdmin: !!adminId });
}
