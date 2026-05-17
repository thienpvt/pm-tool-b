import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Ctx = { params: Promise<{ id: string; itemId: string; expId: string }> };

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

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, itemId, expId } = await params;
  const ctx = await authorize(req, id);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ctx.db.run(
    'DELETE FROM budget_expenses WHERE id = ? AND budget_item_id = ? AND project_id = ?',
    expId, itemId, id
  );

  // Recalculate actual_amount after deletion
  await ctx.db.run(
    `UPDATE budget_items SET actual_amount = (
      SELECT COALESCE(SUM(amount), 0) FROM budget_expenses WHERE budget_item_id = ?
    ) WHERE id = ? AND project_id = ?`,
    itemId, itemId, id
  );

  return NextResponse.json({ ok: true });
}
