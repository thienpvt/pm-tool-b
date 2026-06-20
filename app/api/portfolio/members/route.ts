import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const db = await getDb();
  const members = await db.all(
    `SELECT pm.*,
       COALESCE((
         SELECT COUNT(DISTINCT ppa.program_id)
         FROM team_members tm
         JOIN program_project_allocations ppa ON ppa.project_id = tm.project_id
         WHERE CASE WHEN COALESCE(TRIM(pm.email), '') <> ''
                    THEN LOWER(TRIM(tm.email)) = LOWER(TRIM(pm.email))
                    ELSE LOWER(TRIM(tm.name)) = LOWER(TRIM(pm.name))
               END
       ), 0) AS program_count,
       COALESCE((
         SELECT SUM(
           CASE WHEN tm.capacity_json IS NOT NULL AND length(trim(tm.capacity_json)) > 2
                THEN CAST((tm.capacity_json::jsonb ->> TO_CHAR(CURRENT_DATE, 'YYYY-MM')) AS FLOAT)
                ELSE 0
           END
         )
         FROM team_members tm
         JOIN projects p ON p.id = tm.project_id
         -- Identify the same person by email when available, else by name,
         -- so two different people sharing a name are not summed together.
         WHERE CASE WHEN COALESCE(TRIM(pm.email), '') <> ''
                    THEN LOWER(TRIM(tm.email)) = LOWER(TRIM(pm.email))
                    ELSE LOWER(TRIM(tm.name)) = LOWER(TRIM(pm.name))
               END
           AND p.company_id = pm.company_id
       ), 0) AS current_month_fte
     FROM portfolio_members pm
     WHERE pm.company_id = ?
     ORDER BY pm.name`,
    user.company_id
  );
  return NextResponse.json(members);
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { role = '', name, email = '', note = '', member_type = 'internal', member_category = 'delivery', overhead_remaining = 0 } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const db = await getDb();
  const result = await db.run(
    'INSERT INTO portfolio_members (company_id, role, name, email, note, member_type, member_category, overhead_remaining) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    user.company_id, role, name.trim(), email, note, member_type, member_category, Number(overhead_remaining) || 0
  );
  const row = await db.get('SELECT * FROM portfolio_members WHERE id = ?', result.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}
