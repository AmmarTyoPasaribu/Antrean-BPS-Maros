import 'server-only';
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET!);

export async function signAdminToken(adminId: string): Promise<string> {
  return await new SignJWT({ role: 'admin' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(adminId)
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export async function verifyAdminToken(token: string): Promise<{ adminId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.role !== 'admin' || typeof payload.sub !== 'string') return null;
    return { adminId: payload.sub };
  } catch {
    return null;
  }
}
