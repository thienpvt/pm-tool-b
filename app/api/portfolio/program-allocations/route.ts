import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// GET: ALL programs for this company with their allocation + actual FTE
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.company_id) return NextResponse.json([]);

  const db = await getDb();
  const rows = await db.all<{
    program_id: number; program_name: string; allocated_headcount: number; actual_fte: number;
  }>(
    `SELECT
       c.id AS program_id,
       c.name AS program_name,
       COALESCE(ppa.allocated_headcount, 0) AS allocated_headcount,
       COALESCE((
         SELECT ROUND(CAST(SUM(
           COALESCE(
             CASE WHEN tm.capacity_json IS NOT NULL AND length(trim(tm.capacity_json)) > 2
                  THEN CAST((tm.capacity_json::jsonb ->> TO_CHAR(CURRENT_DATE, 'YYYY-MM')) AS FLOAT)
                  ELSE NULL
             END,
             0
           )
         ) AS NUMERIC), 1)
         FROM team_members tm
         JOIN projects p ON p.id = tm.project_id
         WHERE p.customer_id = c.id
           AND p.company_id = ?
       ), 0) AS actual_fte
     FROM customers c
     LEFT JOIN portfolio_program_allocations ppa
       ON ppa.program_id = c.id AND ppa.company_id = ?
     WHERE c.company_id = ?
     ORDER BY c.name`,
    user.company_id, user.company_id, user.company_id
  );
  return NextResponse.json(rows);
}

// POST: upsert allocation — atomic ON CONFLICT DO UPDATE
export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { program_id, allocated_headcount } = await req.json();
  if (!program_id) return NextResponse.json({ error: 'program_id required' }, { status: 400 });
  const headcount = Math.max(0, Number(allocated_headcount) || 0);
  const db = await getDb();
  try {
    await db.run(
      `INSERT INTO portfolio_program_allocations (company_id, program_id, allocated_headcount)
       VALUES (?, ?, ?)
       ON CONFLICT (company_id, program_id) DO UPDATE SET allocated_headcount = EXCLUDED.allocated_headcount`,
      user.company_id, program_id, headcount
    );
    return NextResponse.json({ program_id, allocated_headcount: headcount });
  } catch (e) {
    console.error('program-allocations POST error:', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
