import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const budget = await db.get('SELECT id FROM portfolio_budgets WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const allocs = await db.all(
    `SELECT pba.*, p.name AS project_name,
            COALESCE(SUM(bi.planned_amount), 0) AS total_estimate,
            COALESCE(SUM(bi.approved_amount), 0) AS total_approved,
            COALESCE(SUM(bi.actual_amount), 0) AS total_actual
     FROM portfolio_budget_allocations pba
     LEFT JOIN projects p ON p.id = pba.project_id
     LEFT JOIN budget_items bi ON bi.project_id = pba.project_id
     WHERE pba.portfolio_budget_id = ?
     GROUP BY pba.id, p.name
     ORDER BY p.name`,
    id
  );
  return NextResponse.json(allocs);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const db = await getDb();

  const budget = await db.get('SELECT id FROM portfolio_budgets WHERE id = ? AND company_id = ?', id, user.company_id);
  if (!budget) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { project_id, allocated_amount, notes } = body;

  const result = await db.run(
    'INSERT INTO portfolio_budget_allocations (portfolio_budget_id, project_id, allocated_amount, notes) VALUES (?, ?, ?, ?)',
    id, project_id || null, allocated_amount || 0, notes || ''
  );
  const created = await db.get(
    `SELECT pba.*, p.name AS project_name FROM portfolio_budget_allocations pba
     LEFT JOIN projects p ON p.id = pba.project_id WHERE pba.id = ?`,
    result.lastInsertRowid
  );
  return NextResponse.json(created, { status: 201 });
}
