import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { createPortfolioBudget, listPortfolioBudgets } from '@/lib/repositories/portfolio.repo';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(await listPortfolioBudgets(user.company_id));
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { period_type, period_label, start_date, end_date, total_amount, currency, notes } = body;
  if (!period_label || !start_date || !end_date) {
    return NextResponse.json({ error: 'period_label, start_date, end_date required' }, { status: 400 });
  }

  const created = await createPortfolioBudget(user.company_id, {
    period_type, period_label, start_date, end_date, total_amount, currency, notes,
  });
  return NextResponse.json(created, { status: 201 });
}
