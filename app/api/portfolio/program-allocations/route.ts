import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// GET: return all programs with their allocated headcount and actual FTE for this company
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();

  // actual_fte = sum of current-month capacity_json values across all team_members
  // in projects belonging to each program (projects.customer_id = program_id)
  const rows = await db.all<{
    id: number; program_id: number; program_name: string; allocated_headcount: number; actual_fte: number;
  }>(
    `SELECT ppa.id, ppa.program_id, c.name AS program_name, ppa.allocated_headcount,
       COALESCE((
         SELECT ROUND(CAST(SUM(
           COALESCE(
             CASE WHEN tm.capacity_json IS NOT NULL AND length(trim(tm.capacity_json)) > 2
                  THEN CAST(
                    (tm.capacity_json::jsonb ->> TO_CHAR(CURRENT_DATE, 'YYYY-MM'))
                    AS FLOAT
                  )
                  ELSE NULL
             END,
             0
           )
         ) AS NUMERIC), 1)
         FROM team_members tm
         JOIN projects p ON p.id = tm.project_id
         WHERE p.customer_id = ppa.program_id
           AND p.company_id = ?
       ), 0) AS actual_fte
     FROM portfolio_program_allocations ppa
     JOIN customers c ON c.id = ppa.program_id
     WHERE ppa.company_id = ?
     ORDER BY c.name`,
    user.company_id, user.company_id
  );
  return NextResponse.json(rows);
}

// POST: upsert allocation (program_id, allocated_headcount)
export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { program_id, allocated_headcount } = await req.json();
  if (!program_id) return NextResponse.json({ error: 'program_id required' }, { status: 400 });
  const headcount = Math.max(0, Number(allocated_headcount) || 0);
  const db = await getDb();
  // upsert
  const existing = await db.get<{ id: number }>(
    'SELECT id FROM portfolio_program_allocations WHERE company_id = ? AND program_id = ?',
    user.company_id, program_id
  );
  if (existing) {
    await db.run(
      'UPDATE portfolio_program_allocations SET allocated_headcount = ? WHERE id = ?',
      headcount, existing.id
    );
    return NextResponse.json({ id: existing.id, program_id, allocated_headcount: headcount });
  }
  const row = await db.get<{ id: number }>(
    'INSERT INTO portfolio_program_allocations (company_id, program_id, allocated_headcount) VALUES (?, ?, ?) RETURNING id',
    user.company_id, program_id, headcount
  );
  return NextResponse.json({ id: row?.id, program_id, allocated_headcount: headcount });
}
