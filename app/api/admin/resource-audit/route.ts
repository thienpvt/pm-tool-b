import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { addMissingTeamMembersToPortfolio, resourceAudit } from '@/lib/repositories/admin.repo';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cid = user.company_id;
  const { company, inPortfolioNotInTeams, inTeamsNotInPortfolio } = await resourceAudit(cid);

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

// POST: add all "in_teams_not_in_portfolio" as external portfolio members
export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cid = user.company_id;
  const missing = await addMissingTeamMembersToPortfolio(cid);
  return NextResponse.json({ added: missing.length, members: missing });
}
