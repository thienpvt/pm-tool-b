import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = getSessionFromRequest(req);
    if (!user) return NextResponse.json([], { status: 401 });

    const db = getDb();
    const members = user.is_admin
      ? db.prepare(`
          SELECT tm.*, p.name as project_name, p.id as project_id,
                 p.start_date, p.end_date, p.current_phase, p.client
          FROM team_members tm
          JOIN projects p ON p.id = tm.project_id
          ORDER BY tm.domain, tm.name, p.name
        `).all()
      : db.prepare(`
          SELECT tm.*, p.name as project_name, p.id as project_id,
                 p.start_date, p.end_date, p.current_phase, p.client
          FROM team_members tm
          JOIN projects p ON p.id = tm.project_id
          WHERE p.company_id = ?
          ORDER BY tm.domain, tm.name, p.name
        `).all(user.company_id);

    return NextResponse.json(members);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
