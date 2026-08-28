import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { addBudgetAdjustment } from '@/lib/services/fiscal-budget.service';

type Params = { id: string; budgetId: string };

const budgetAdjustmentCreateSchema = z.object({}).passthrough();

export const POST = withProjectAccess<Params>(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await addBudgetAdjustment(params.id, params.budgetId, actor, body as Record<string, unknown>),
      { status: 201 },
    ),
  { schema: budgetAdjustmentCreateSchema },
);
