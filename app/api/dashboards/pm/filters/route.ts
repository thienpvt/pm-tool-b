import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { dashboardFiltersSchema, filterActionSchema } from '@/lib/dashboards/filter-schema';
import { hasRole, type AccessActor } from '@/lib/services/access';
import { ForbiddenError } from '@/lib/services/errors';
import {
  clearPmDashboardFilters,
  getPmDashboardFilters,
  savePmDashboardFilters,
} from '@/lib/services/spec-dashboards.service';

function assertPmRouteActor(actor: AccessActor): void {
  if (actor.company_id === null) throw new ForbiddenError();
  if (!hasRole(actor, 'pm') && !hasRole(actor, 'cpmo')) throw new ForbiddenError();
}

export const GET = withAuth(async (_req, { actor }) => {
  assertPmRouteActor(actor);
  return NextResponse.json(await getPmDashboardFilters(actor));
});

export const PUT = withAuth(
  async (_req, { actor, body }) => {
    assertPmRouteActor(actor);
    await savePmDashboardFilters(actor, body as Record<string, unknown>);
    return NextResponse.json({ ok: true });
  },
  { schema: dashboardFiltersSchema },
);

export const POST = withAuth(
  async (_req, { actor, body }) => {
    assertPmRouteActor(actor);
    const { action } = body as { action: 'clear' | 'defaults' };
    if (action === 'clear' || action === 'defaults') {
      await clearPmDashboardFilters(actor);
    }
    return NextResponse.json({ ok: true });
  },
  { schema: filterActionSchema },
);
