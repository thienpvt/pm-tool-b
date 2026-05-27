import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const budgets = await db.all(
    `SELECT pb.*,
            COALESCE(SUM(pba.allocated_amount), 0) AS total_allocated
     FROM portfolio_budgets pb
     LEFT JOIN portfolio_budget_allocations pba ON pba.portfolio_budget_id = pb.id
     WHERE pb.company_id = ?
     GROUP BY pb.id
     ORDER BY pb.start_date DESC`,
    user.company_id
  );
  return NextResponse.json(budgets);
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { period_type, period_label, start_date, end_date, total_amount, currency, notes } = body;
  if (!period_label || !start_date || !end_date) {
    return NextResponse.json({ error: 'period_label, start_date, end_date required' }, { status: 400 });
  }

  const db = await getDb();
  const result = await db.run(
    `INSERT INTO portfolio_budgets (company_id, period_type, period_label, start_date, end_date, total_amount, currency, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    user.company_id,
    period_type || 'quarterly',
    period_label,
    start_date,
    end_date,
    total_amount || 0,
    currency || 'VND',
    notes || ''
  );
  const created = await db.get('SELECT * FROM portfolio_budgets WHERE id = ?', result.lastInsertRowid);
  return NextResponse.json(created, { status: 201 });
}
