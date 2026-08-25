import { NextRequest, NextResponse } from 'next/server';
import { findUserByUsername } from '@/lib/repositories/auth.repo';
import { verifyPassword, createSession, SESSION_COOKIE_NAME } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const { username, password } = await req.json();
  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }

  const user = await findUserByUsername(String(username).trim());
  const status = user?.status ?? 'active';
  if (
    !user
    || status !== 'active'
    || !verifyPassword(String(password), user.password_hash)
  ) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }

  const sessionId = await createSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  });
  return res;
}
