import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest, forbidden, unauthorized } from '@/lib/auth';

async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}

export async function GET(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const db = await getDb();
  const companies = await db.all(`
    SELECT c.*, COUNT(u.id) as user_count
    FROM companies c
    LEFT JOIN users u ON u.company_id = c.id
    GROUP BY c.id ORDER BY c.name
  `);
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const db = await getDb();
  try {
    const r = await db.run('INSERT INTO companies (name) VALUES (?)', name.trim());
    const newCompany = await db.get('SELECT * FROM companies WHERE id = ?', r.lastInsertRowid);
    return NextResponse.json(newCompany, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Company name already exists' }, { status: 409 });
  }
}

export async function PUT(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { id, name } = await req.json();
  if (!id || !name?.trim()) return NextResponse.json({ error: 'id and name required' }, { status: 400 });
  const db = await getDb();
  await db.run('UPDATE companies SET name = ? WHERE id = ?', name.trim(), id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const db = await getDb();
  await db.run('DELETE FROM companies WHERE id = ?', Number(id));
  return NextResponse.json({ ok: true });
}
