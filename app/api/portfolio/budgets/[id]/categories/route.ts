import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { toAccessActor } from '@/lib/services/access';
import { createBudgetCategory, listBudgetCategories } from '@/lib/services/portfolio.service';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  try {
    return NextResponse.json(await listBudgetCategories(id, toAccessActor(user)));
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  try {
    const created = await createBudgetCategory(id, toAccessActor(user), body);
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
