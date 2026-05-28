import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

// GET: all projects in this program with their allocated headcount from this program
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: programId } = await params;
  const db = await getDb();

  // Get all projects under this program
  const projects = await db.all<{
    project_id: number; project_name: string; allocated_headcount: number;
  }>(
    `SELECT p.id AS project_id, p.name AS project_name,
            COALESCE(ppa.allocated_headcount, 0) AS allocated_headcount
     FROM projects p
     LEFT JOIN program_project_allocations ppa ON ppa.project_id = p.id AND ppa.program_id = ?
     WHERE p.customer_id = ? AND (p.company_id = ? OR ? = 1)
     ORDER BY p.name`,
    programId, programId, user.company_id, user.is_admin
  );

  // Get portfolio allocation + program name
  const programInfo = await db.get<{ allocated_headcount: number; name: string }>(
    `SELECT c.name, COALESCE(ppa.allocated_headcount, 0) AS allocated_headcount
     FROM customers c
     LEFT JOIN portfolio_program_allocations ppa ON ppa.program_id = c.id AND ppa.company_id = ?
     WHERE c.id = ?`,
    user.company_id, programId
  );

  return NextResponse.json({
    program_id: Number(programId),
    program_name: programInfo?.name ?? '',
    portfolio_allocated: programInfo?.allocated_headcount ?? 0,
    projects,
  });
}

// POST: upsert allocation from program to project
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: programId } = await params;
  const { project_id, allocated_headcount } = await req.json();
  if (!project_id) return NextResponse.json({ error: 'project_id required' }, { status: 400 });
  const headcount = Math.max(0, Number(allocated_headcount) || 0);
  const db = await getDb();

  const existing = await db.get<{ id: number }>(
    'SELECT id FROM program_project_allocations WHERE program_id = ? AND project_id = ?',
    programId, project_id
  );
  if (existing) {
    await db.run(
      'UPDATE program_project_allocations SET allocated_headcount = ? WHERE id = ?',
      headcount, existing.id
    );
    return NextResponse.json({ id: existing.id, project_id, allocated_headcount: headcount });
  }
  const row = await db.get<{ id: number }>(
    'INSERT INTO program_project_allocations (program_id, project_id, allocated_headcount) VALUES (?, ?, ?) RETURNING id',
    programId, project_id, headcount
  );
  return NextResponse.json({ id: row?.id, project_id, allocated_headcount: headcount });
}
