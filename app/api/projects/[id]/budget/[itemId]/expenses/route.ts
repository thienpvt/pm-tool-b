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

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  const ctx = await authorize(req, id);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const expenses = await ctx.db.all(
    'SELECT * FROM budget_expenses WHERE budget_item_id = ? AND project_id = ? ORDER BY expense_date, created_at',
    itemId, id
  );
  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  const ctx = await authorize(req, id);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { expense_date, description, amount, reference } = body;

  if (!description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 });

  const item = await ctx.db.get<{ id: number }>(
    'SELECT id FROM budget_items WHERE id = ? AND project_id = ?', itemId, id
  );
  if (!item) return NextResponse.json({ error: 'Budget item not found' }, { status: 404 });

  const result = await ctx.db.run(
    `INSERT INTO budget_expenses (budget_item_id, project_id, expense_date, description, amount, reference)
     VALUES (?, ?, ?, ?, ?, ?)`,
    itemId, id,
    expense_date || new Date().toISOString().slice(0, 10),
    description.trim(),
    Number(amount) || 0,
    reference?.trim() ?? ''
  );

  // Auto-update actual_amount on budget_item to sum of all expenses
  await ctx.db.run(
    `UPDATE budget_items SET actual_amount = (
      SELECT COALESCE(SUM(amount), 0) FROM budget_expenses WHERE budget_item_id = ?
    ) WHERE id = ? AND project_id = ?`,
    itemId, itemId, id
  );

  const expense = await ctx.db.get('SELECT * FROM budget_expenses WHERE id = ?', result.lastInsertRowid);
  return NextResponse.json(expense, { status: 201 });
}
