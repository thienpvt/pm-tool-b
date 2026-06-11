import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();

  // Returns bug counts per assignee using latest snapshot per project
  let rows: any[];

  const baseQuery = (whereClause: string) => `
    SELECT
      b.assignee,
      COUNT(*) as total_bugs,
      SUM(CASE WHEN b.status IN ('To Do', 'In Progress', 'Reopen') THEN 1 ELSE 0 END) as active_bugs,
      SUM(CASE WHEN b.priority = 'Critical' THEN 1 ELSE 0 END) as critical_bugs,
      STRING_AGG(DISTINCT p.name, ', ') as projects,
      COUNT(DISTINCT b.project_id) as project_count
    FROM bugs b
    JOIN projects p ON b.project_id = p.id
    LEFT JOIN customers c ON p.customer_id = c.id
    WHERE b.assignee IS NOT NULL AND b.assignee != ''
      ${whereClause}
      AND b.snapshot_date = (
        SELECT MAX(b2.snapshot_date) FROM bugs b2
        WHERE b2.project_id = b.project_id AND b2.snapshot_date != ''
      )
    GROUP BY b.assignee
    ORDER BY total_bugs DESC
  `;

  if (user.is_admin) {
    rows = await db.all(baseQuery(''));
  } else if (user.company_id !== null) {
    rows = await db.all(
      baseQuery('AND (p.company_id = ? OR c.company_id = ?)'),
      user.company_id, user.company_id,
    );
  } else {
    rows = await db.all(baseQuery('AND p.company_id IS NULL AND (p.customer_id IS NULL OR c.company_id IS NULL)'));
  }

  return NextResponse.json(rows ?? []);
}
