import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = getSessionFromRequest(req);
  if (!user) return NextResponse.json([], { status: 401 });

  const db = getDb();
  const customers = user.is_admin
    ? db.prepare('SELECT * FROM customers ORDER BY name').all()
    : db.prepare('SELECT * FROM customers WHERE company_id = ? ORDER BY name').all(user.company_id);

  const projectCounts = db.prepare('SELECT customer_id, COUNT(*) as count FROM projects WHERE customer_id IS NOT NULL GROUP BY customer_id').all() as { customer_id: number; count: number }[];
  const countMap = Object.fromEntries(projectCounts.map(r => [r.customer_id, r.count]));
  return NextResponse.json(customers.map((c: any) => ({ ...c, project_count: countMap[c.id] ?? 0 })));
}

export async function POST(req: NextRequest) {
  const user = getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const db = getDb();
  const companyId = user.is_admin ? (body.company_id ?? null) : user.company_id;
  const r = db.prepare(
    'INSERT INTO customers (name, industry, contact_name, contact_email, contact_phone, website, notes, company_id) VALUES (?,?,?,?,?,?,?,?)'
  ).run(body.name, body.industry ?? '', body.contact_name ?? '', body.contact_email ?? '', body.contact_phone ?? '', body.website ?? '', body.notes ?? '', companyId);
  return NextResponse.json(db.prepare('SELECT * FROM customers WHERE id = ?').get(r.lastInsertRowid), { status: 201 });
}
