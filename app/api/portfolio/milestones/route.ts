import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// Danh sách milestone của toàn bộ project mà user xem được (kèm tên project).
// Dùng cho selector "Theo Milestone" trong Portfolio Roadmap.
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = await getDb();

  const base = `SELECT m.id, m.project_id, m.name, m.start_date, m.end_date,
                       p.name AS project_name, p.customer_id, c.name AS program_name
                FROM milestones m
                JOIN projects p ON p.id = m.project_id
                LEFT JOIN customers c ON p.customer_id = c.id`;

  const milestones = user.is_admin
    ? await db.all(`${base} ORDER BY p.name, m.start_date, m.id`) as any[]
    : user.company_id !== null
      ? await db.all(`${base} WHERE (p.company_id = ? OR c.company_id = ?) ORDER BY p.name, m.start_date, m.id`, user.company_id, user.company_id) as any[]
      : await db.all(`${base} WHERE (p.company_id IS NULL OR c.company_id IS NULL) ORDER BY p.name, m.start_date, m.id`) as any[];

  return NextResponse.json(milestones);
}
