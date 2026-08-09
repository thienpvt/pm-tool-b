import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  programProjectAllocations,
  upsertProgramProjectAllocation,
} from '@/lib/repositories/programs.repo';

// GET: all projects in this program with their allocated headcount from this program
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: programId } = await params;
  const { program: programInfo, projects } = await programProjectAllocations(
    programId, user.company_id, Boolean(user.is_admin),
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
  const id = await upsertProgramProjectAllocation(programId, project_id, headcount);
  return NextResponse.json({ id, project_id, allocated_headcount: headcount });
}
