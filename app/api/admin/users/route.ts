import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest, forbidden, unauthorized, hashPassword } from '@/lib/auth';

async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}

export async function GET(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const db = await getDb();
  const users = await db.all(`
    SELECT u.id, u.username, u.display_name, u.company_id, u.is_admin, u.created_at, c.name as company_name
    FROM users u
    LEFT JOIN companies c ON u.company_id = c.id
    ORDER BY u.is_admin DESC, u.username
  `);
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { username, password, display_name, company_id, is_admin } = await req.json();
  if (!username?.trim() || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }
  const db = await getDb();
  try {
    const r = await db.run(
      `INSERT INTO users (username, password_hash, display_name, company_id, is_admin) VALUES (?, ?, ?, ?, ?)`,
      username.trim(), hashPassword(password), display_name ?? '', company_id ?? null, is_admin ? 1 : 0
    );
    const newUser = await db.get('SELECT id, username, display_name, company_id, is_admin FROM users WHERE id = ?', r.lastInsertRowid);
    return NextResponse.json(newUser, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
  }
}

export async function PUT(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { id, display_name, company_id, is_admin, password } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = await getDb();
  if (password) {
    await db.run('UPDATE users SET password_hash = ? WHERE id = ?', hashPassword(password), id);
  }
  await db.run(
    'UPDATE users SET display_name = ?, company_id = ?, is_admin = ? WHERE id = ?',
    display_name ?? '', company_id ?? null, is_admin ? 1 : 0, id
  );
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const self = await getSessionFromRequest(req);
  if (self?.id === Number(id)) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  const db = await getDb();
  await db.run('DELETE FROM users WHERE id = ?', Number(id));
  return NextResponse.json({ ok: true });
}
