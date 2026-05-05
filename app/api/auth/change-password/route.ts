import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, hashPassword, verifyPassword } from '@/lib/auth';
import { getDb } from '@/lib/db';

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { current_password, new_password } = await req.json();
  if (!current_password || !new_password)
    return NextResponse.json({ error: 'Both fields are required' }, { status: 400 });
  if (new_password.length < 6)
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });

  const db = await getDb();
  const row = await db.get<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = ?', user.id);
  if (!row) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (!verifyPassword(current_password, row.password_hash))
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 400 });

  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(new_password), user.id);
  return NextResponse.json({ ok: true });
}
