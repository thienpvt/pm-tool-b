import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest, forbidden, unauthorized } from '@/lib/auth';

function requireAdmin(req: NextRequest) {
  const user = getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}

export async function GET(req: NextRequest) {
  const err = requireAdmin(req); if (err) return err;
  const db = getDb();
  const companies = db.prepare(`
    SELECT c.*, COUNT(u.id) as user_count
    FROM companies c
    LEFT JOIN users u ON u.company_id = c.id
    GROUP BY c.id ORDER BY c.name
  `).all();
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const err = requireAdmin(req); if (err) return err;
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const db = getDb();
  try {
    const r = db.prepare('INSERT INTO companies (name) VALUES (?)').run(name.trim());
    return NextResponse.json(db.prepare('SELECT * FROM companies WHERE id = ?').get(r.lastInsertRowid), { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Company name already exists' }, { status: 409 });
  }
}

export async function PUT(req: NextRequest) {
  const err = requireAdmin(req); if (err) return err;
  const { id, name } = await req.json();
  if (!id || !name?.trim()) return NextResponse.json({ error: 'id and name required' }, { status: 400 });
  const db = getDb();
  db.prepare('UPDATE companies SET name = ? WHERE id = ?').run(name.trim(), id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const err = requireAdmin(req); if (err) return err;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  getDb().prepare('DELETE FROM companies WHERE id = ?').run(Number(id));
  return NextResponse.json({ ok: true });
}
