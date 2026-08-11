import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { createBudgetItem, getBudgetOverview } from '@/lib/services/budget.service';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await getBudgetOverview(params.id, actor)),
);

export const POST = withProjectAccess(async (_req, { params, actor, body }) =>
  NextResponse.json(await createBudgetItem(params.id, actor, body as Record<string, unknown>), { status: 201 }),
);
