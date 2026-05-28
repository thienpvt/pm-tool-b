import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { allocated_headcount } = await req.json();
  const headcount = Math.max(0, Number(allocated_headcount) || 0);
  const db = await getDb();
  await db.run(
    'UPDATE portfolio_program_allocations SET allocated_headcount = ? WHERE id = ? AND company_id = ?',
    headcount, id, user.company_id
  );
  return NextResponse.json({ id: Number(id), allocated_headcount: headcount });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const db = await getDb();
  await db.run(
    'DELETE FROM portfolio_program_allocations WHERE id = ? AND company_id = ?',
    id, user.company_id
  );
  return NextResponse.json({ ok: true });
}
