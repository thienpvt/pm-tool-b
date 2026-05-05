import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest, forbidden, unauthorized, hashPassword } from '@/lib/auth';

function requireAdmin(req: NextRequest) {
  const user = getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}

export async function GET(req: NextRequest) {
  const err = requireAdmin(req); if (err) return err;
  const users = getDb().prepare(`
    SELECT u.id, u.username, u.display_name, u.company_id, u.is_admin, u.created_at, c.name as company_name
    FROM users u
    LEFT JOIN companies c ON u.company_id = c.id
    ORDER BY u.is_admin DESC, u.username
  `).all();
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const err = requireAdmin(req); if (err) return err;
  const { username, password, display_name, company_id, is_admin } = await req.json();
  if (!username?.trim() || !password) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }
  const db = getDb();
  try {
    const r = db.prepare(`
      INSERT INTO users (username, password_hash, display_name, company_id, is_admin)
      VALUES (?, ?, ?, ?, ?)
    `).run(username.trim(), hashPassword(password), display_name ?? '', company_id ?? null, is_admin ? 1 : 0);
    return NextResponse.json(db.prepare('SELECT id, username, display_name, company_id, is_admin FROM users WHERE id = ?').get(r.lastInsertRowid), { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
  }
}

export async function PUT(req: NextRequest) {
  const err = requireAdmin(req); if (err) return err;
  const { id, display_name, company_id, is_admin, password } = await req.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = getDb();
  if (password) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), id);
  }
  db.prepare('UPDATE users SET display_name = ?, company_id = ?, is_admin = ? WHERE id = ?')
    .run(display_name ?? '', company_id ?? null, is_admin ? 1 : 0, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const err = requireAdmin(req); if (err) return err;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const self = getSessionFromRequest(req);
  if (self?.id === Number(id)) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  getDb().prepare('DELETE FROM users WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
