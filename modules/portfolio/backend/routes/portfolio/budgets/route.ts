import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { toAccessActor } from '@/lib/services/access';
import { createBudget, listBudgets } from '@/modules/portfolio/backend/services/portfolio.service';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  return NextResponse.json(await listBudgets(toAccessActor(user)));
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  try {
    const created = await createBudget(toAccessActor(user), body);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
