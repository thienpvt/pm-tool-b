import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const cid = user.company_id;

  const company = await db.get<{ id: number; name: string }>(
    'SELECT id, name FROM companies WHERE id = ?', cid
  );

  // A: portfolio internal members not in any project team
  const inPortfolioNotInTeams = await db.all<{ name: string; role: string; email: string }>(
    `SELECT pm.name, pm.role, pm.email
     FROM portfolio_members pm
     WHERE pm.company_id = ?
       AND pm.member_type != 'external'
       AND LOWER(TRIM(pm.name)) NOT IN (
         SELECT LOWER(TRIM(tm.name))
         FROM team_members tm
         JOIN projects p ON p.id = tm.project_id
         WHERE p.company_id = ?
       )
     ORDER BY pm.name`,
    cid, cid
  );

  // B: team members not in portfolio roster
  const inTeamsNotInPortfolio = await db.all<{ name: string; role: string; projects: string }>(
    `SELECT tm.name, tm.role,
            STRING_AGG(DISTINCT p.name, ', ' ORDER BY p.name) AS projects
     FROM team_members tm
     JOIN projects p ON p.id = tm.project_id
     WHERE p.company_id = ?
       AND LOWER(TRIM(tm.name)) NOT IN (
         SELECT LOWER(TRIM(pm.name))
         FROM portfolio_members pm
         WHERE pm.company_id = ?
           AND pm.member_type != 'external'
       )
     GROUP BY tm.name, tm.role
     ORDER BY tm.name`,
    cid, cid
  );

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

  const db = await getDb();
  const cid = user.company_id;

  const missing = await db.all<{ name: string; role: string }>(
    `SELECT DISTINCT tm.name, tm.role
     FROM team_members tm
     JOIN projects p ON p.id = tm.project_id
     WHERE p.company_id = ?
       AND LOWER(TRIM(tm.name)) NOT IN (
         SELECT LOWER(TRIM(pm.name))
         FROM portfolio_members pm
         WHERE pm.company_id = ?
       )
     ORDER BY tm.name`,
    cid, cid
  );

  let added = 0;
  for (const m of missing) {
    await db.run(
      'INSERT INTO portfolio_members (company_id, role, name, email, note, member_type) VALUES (?, ?, ?, ?, ?, ?)',
      cid, m.role || '', m.name.trim(), '', '', 'external'
    );
    added++;
  }

  return NextResponse.json({ added, members: missing });
}
