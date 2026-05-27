import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json([], { status: 401 });

  const db = await getDb();
  const programs = user.is_admin
    ? await db.all('SELECT * FROM customers ORDER BY name')
    : user.company_id !== null
      ? await db.all('SELECT * FROM customers WHERE company_id = ? ORDER BY name', user.company_id)
      : await db.all('SELECT * FROM customers WHERE company_id IS NULL ORDER BY name');

  const projectCounts = await db.all('SELECT customer_id, COUNT(*) as count FROM projects WHERE customer_id IS NOT NULL GROUP BY customer_id') as { customer_id: number; count: number }[];
  const countMap = Object.fromEntries(projectCounts.map(r => [r.customer_id, r.count]));
  return NextResponse.json(programs.map((c: any) => ({ ...c, project_count: countMap[c.id] ?? 0 })));
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  if (!body.name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const db = await getDb();
  const companyId = user.is_admin ? (body.company_id ?? null) : user.company_id;
  const r = await db.run(
    'INSERT INTO customers (name, industry, contact_name, contact_email, contact_phone, website, notes, company_id) VALUES (?,?,?,?,?,?,?,?)',
    body.name, body.industry ?? '', body.contact_name ?? '', body.contact_email ?? '', body.contact_phone ?? '', body.website ?? '', body.notes ?? '', companyId
  );
  return NextResponse.json(await db.get('SELECT * FROM customers WHERE id = ?', r.lastInsertRowid), { status: 201 });
}
