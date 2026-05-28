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
         WHERE tm.name = pm.name
       ), 0) AS program_count
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
  const { role = '', name, email = '', note = '', member_type = 'internal', member_category = 'delivery' } = body;
  if (!name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
  const db = await getDb();
  const result = await db.run(
    'INSERT INTO portfolio_members (company_id, role, name, email, note, member_type, member_category) VALUES (?, ?, ?, ?, ?, ?, ?)',
    user.company_id, role, name.trim(), email, note, member_type, member_category
  );
  const row = await db.get('SELECT * FROM portfolio_members WHERE id = ?', result.lastInsertRowid);
  return NextResponse.json(row, { status: 201 });
}
