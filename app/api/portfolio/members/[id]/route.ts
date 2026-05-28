import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const { role = '', name, email = '', note = '', member_type = 'internal', member_category = 'delivery', overhead_remaining = 0 } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const db = await getDb();
  await db.run(
    'UPDATE portfolio_members SET role = ?, name = ?, email = ?, note = ?, member_type = ?, member_category = ?, overhead_remaining = ? WHERE id = ? AND company_id = ?',
    role, name.trim(), email, note, member_type, member_category, Number(overhead_remaining) || 0, id, user.company_id
  );
  const row = await db.get('SELECT * FROM portfolio_members WHERE id = ?', id);
  return NextResponse.json(row);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const db = await getDb();
  await db.run('DELETE FROM portfolio_members WHERE id = ? AND company_id = ?', id, user.company_id);
  return NextResponse.json({ ok: true });
}
