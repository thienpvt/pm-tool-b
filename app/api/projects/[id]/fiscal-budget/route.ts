import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  createFiscalBudget,
  getFiscalBudgetOverview,
  patchFiscalBudgetActual,
} from '@/lib/services/fiscal-budget.service';

const fiscalBudgetCreateSchema = z.object({}).passthrough();
const fiscalBudgetPatchSchema = z.object({}).passthrough();

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await getFiscalBudgetOverview(params.id, actor)),
);

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await createFiscalBudget(params.id, actor, body as Record<string, unknown>),
      { status: 201 },
    ),
  { schema: fiscalBudgetCreateSchema },
);

export const PATCH = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await patchFiscalBudgetActual(params.id, actor, body as Record<string, unknown>),
    ),
  { schema: fiscalBudgetPatchSchema },
);
