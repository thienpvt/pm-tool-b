import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  addMissingTeamMembersToPortfolioForCompany,
  getResourceAudit,
} from '@/modules/admin/backend/services/admin-platform.service';
import { assertCompanyWrite, toAccessActor } from '@/lib/services/access';
import { serviceErrorResponse } from '@/lib/api-errors';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (user.company_id === null) {
    return NextResponse.json({ error: 'Company context required' }, { status: 400 });
  }

  const cid = user.company_id;
  const { company, inPortfolioNotInTeams, inTeamsNotInPortfolio } = await getResourceAudit(cid);

  return NextResponse.json({
    company,
    summary: {
      in_portfolio_not_in_teams: inPortfolioNotInTeams.length,
      in_teams_not_in_portfolio: inTeamsNotInPortfolio.length,
    },
    in_portfolio_not_in_teams: inPortfolioNotInTeams,
    in_teams_not_in_portfolio: inTeamsNotInPortfolio,
  });
}

// POST: add all "in_teams_not_in_portfolio" as external portfolio members (D-24 product write).
export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const actor = toAccessActor(user);
    assertCompanyWrite(actor);
    const missing = await addMissingTeamMembersToPortfolioForCompany(actor.company_id);
    return NextResponse.json({ added: missing.length, members: missing });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
