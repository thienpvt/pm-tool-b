import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  const customer = await db.get('SELECT * FROM customers WHERE id = ?', id);
  if (!customer) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const projects = await db.all('SELECT * FROM projects WHERE customer_id = ? ORDER BY created_at DESC', id);
  return NextResponse.json({ customer, projects });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const db = await getDb();
  await db.run(
    'UPDATE customers SET name=?, industry=?, contact_name=?, contact_email=?, contact_phone=?, website=?, notes=? WHERE id=?',
    body.name, body.industry ?? '', body.contact_name ?? '', body.contact_email ?? '', body.contact_phone ?? '', body.website ?? '', body.notes ?? '', id
  );
  return NextResponse.json(await db.get('SELECT * FROM customers WHERE id = ?', id));
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const db = await getDb();
  await db.run('DELETE FROM customers WHERE id = ?', id);
  return NextResponse.json({ ok: true });
}
