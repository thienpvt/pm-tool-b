import { NextResponse } from 'next/server';
import { withCpmo } from '@/lib/http/with-role';
import { getPortfolioDashboard } from '@/modules/dashboards/backend/services/spec-dashboards.service';

export const GET = withCpmo(async (_req, { actor }) => {
  return NextResponse.json(await getPortfolioDashboard(actor));
});
