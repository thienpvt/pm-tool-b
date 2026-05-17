import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

async function authorize(req: NextRequest, projectId: string) {
  const user = await getSessionFromRequest(req);
  if (!user) return null;
  const db = await getDb();
  const project = await db.get<{ id: number; company_id: number }>(
    'SELECT id, company_id FROM projects WHERE id = ?', projectId
  );
  if (!project) return null;
  if (!user.is_admin && project.company_id !== user.company_id) return null;
  return { user, db };
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  const ctx = await authorize(req, id);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { type, group_name, name, planned_amount, actual_amount, unit, notes } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  if (!['CAPEX', 'OPEX'].includes(type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

  await ctx.db.run(
    `UPDATE budget_items SET type=?, group_name=?, name=?, planned_amount=?, actual_amount=?, unit=?, notes=?
     WHERE id=? AND project_id=?`,
    type,
    group_name?.trim() ?? '',
    name.trim(),
    Number(planned_amount) || 0,
    Number(actual_amount) || 0,
    unit?.trim() || 'USD',
    notes?.trim() ?? '',
    itemId,
    id
  );

  const item = await ctx.db.get('SELECT * FROM budget_items WHERE id = ?', itemId);
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  const ctx = await authorize(req, id);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ctx.db.run('DELETE FROM budget_items WHERE id = ? AND project_id = ?', itemId, id);
  return NextResponse.json({ ok: true });
}
