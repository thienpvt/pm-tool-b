import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = getDb();
  const customer = db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const projects = db.prepare('SELECT * FROM projects WHERE customer_id = ? ORDER BY created_at DESC').all(id);
  return NextResponse.json({ customer, projects });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = getDb();
  db.prepare(
    'UPDATE customers SET name=?, industry=?, contact_name=?, contact_email=?, contact_phone=?, website=?, notes=? WHERE id=?'
  ).run(body.name, body.industry ?? '', body.contact_name ?? '', body.contact_email ?? '', body.contact_phone ?? '', body.website ?? '', body.notes ?? '', id);
  return NextResponse.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(id));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  getDb().prepare('DELETE FROM customers WHERE id = ?').run(id);
  return NextResponse.json({ ok: true });
}
