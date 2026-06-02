import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json([], { status: 401 });

    const db = await getDb();
    const members = user.is_admin
      ? await db.all(`
          SELECT tm.*, p.name as project_name, p.id as project_id,
                 p.start_date, p.end_date, p.current_phase, p.client
          FROM team_members tm
          JOIN projects p ON p.id = tm.project_id
          ORDER BY tm.domain, tm.name, p.name
        `)
      : user.company_id !== null
        ? await db.all(`
            SELECT tm.*, p.name as project_name, p.id as project_id,
                   p.start_date, p.end_date, p.current_phase, p.client
            FROM team_members tm
            JOIN projects p ON p.id = tm.project_id
            LEFT JOIN customers c ON p.customer_id = c.id
            WHERE (p.company_id = ? OR c.company_id = ?)
            ORDER BY tm.domain, tm.name, p.name
          `, user.company_id, user.company_id)
        : await db.all(`
            SELECT tm.*, p.name as project_name, p.id as project_id,
                   p.start_date, p.end_date, p.current_phase, p.client
            FROM team_members tm
            JOIN projects p ON p.id = tm.project_id
            LEFT JOIN customers c ON p.customer_id = c.id
            WHERE (p.company_id IS NULL OR c.company_id IS NULL)
            ORDER BY tm.domain, tm.name, p.name
          `);

    return NextResponse.json(members);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
