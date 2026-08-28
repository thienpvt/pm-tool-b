import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { hasRole } from '@/lib/services/access';
import { ForbiddenError } from '@/lib/services/errors';
import { getPmDashboard } from '@/modules/dashboards/backend/services/spec-dashboards.service';

export const GET = withAuth(async (_req, { actor }) => {
  if (actor.company_id === null) throw new ForbiddenError();
  if (!hasRole(actor, 'pm') && !hasRole(actor, 'cpmo')) throw new ForbiddenError();
  return NextResponse.json(await getPmDashboard(actor));
});
