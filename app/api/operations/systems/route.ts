import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();
  const systems = await db.all(
    `SELECT os.*,
            p.name AS project_name,
            COALESCE(SUM(obi.planned_amount), 0) AS total_planned,
            COALESCE(SUM(obi.actual_amount), 0) AS total_actual,
            (SELECT COUNT(*) FROM operations_incidents oi WHERE oi.operations_system_id = os.id AND oi.status != 'Resolved') AS open_incidents
     FROM operations_systems os
     LEFT JOIN projects p ON p.id = os.project_id
     LEFT JOIN operations_budget_items obi ON obi.operations_system_id = os.id
     WHERE os.company_id = ?
     GROUP BY os.id, p.name
     ORDER BY os.name`,
    user.company_id
  );
  return NextResponse.json(systems);
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { name, description, project_id, go_live_date, status } = body;
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });

  const db = await getDb();
  const result = await db.run(
    'INSERT INTO operations_systems (company_id, project_id, name, description, go_live_date, status) VALUES (?, ?, ?, ?, ?, ?)',
    user.company_id,
    project_id || null,
    name,
    description || '',
    go_live_date || null,
    status || 'active'
  );
  const created = await db.get('SELECT * FROM operations_systems WHERE id = ?', result.lastInsertRowid);
  return NextResponse.json(created, { status: 201 });
}
