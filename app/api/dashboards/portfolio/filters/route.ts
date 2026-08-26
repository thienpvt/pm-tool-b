import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { dashboardFiltersSchema, filterActionSchema } from '@/lib/dashboards/filter-schema';
import {
  clearPortfolioDashboardFilters,
  getPortfolioDashboardFilters,
  savePortfolioDashboardFilters,
} from '@/lib/services/spec-dashboards.service';

export const GET = withCpmo(async (_req, { actor }) =>
  NextResponse.json(await getPortfolioDashboardFilters(actor)),
);

export const PUT = withCpmo(
  async (_req, { actor, body }) => {
    await savePortfolioDashboardFilters(actor, body as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  },
  { schema: dashboardFiltersSchema },
);

export const POST = withCpmo(
  async (_req, { actor, body }) => {
    const { action } = body as { action: 'clear' | 'defaults' };
    if (action === 'clear' || action === 'defaults') {
      await clearPortfolioDashboardFilters(actor);
    }
    return NextResponse.json({ ok: true });
  },
  { schema: filterActionSchema },
);
