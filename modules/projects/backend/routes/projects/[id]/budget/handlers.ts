import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { createBudgetItem, getBudgetOverview } from '@/modules/projects/backend/services/budget.service';
import { budgetItemInputSchema } from './schema';

export async function getBudgetHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await getBudgetOverview(params.id, actor)); }

export async function postBudgetHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await createBudgetItem(params.id, actor, body as Record<string, unknown>), { status: 201 }); }
