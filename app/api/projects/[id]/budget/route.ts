import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { createBudgetItem, getBudgetOverview } from '@/lib/services/budget.service';

type Ctx = { params: Promise<{ id: string }> };

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await getBudgetOverview(id, actorOf(user)));
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    return NextResponse.json(await createBudgetItem(id, actorOf(user), body), { status: 201 });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
