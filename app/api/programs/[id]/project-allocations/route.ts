import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { assertProjectAccess } from '@/lib/services/access';
import { assertProgramAccess } from '@/lib/services/programs.service';
import {
  programProjectAllocations,
  upsertProgramProjectAllocation,
} from '@/lib/repositories/programs.repo';

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

// GET: all projects in this program with their allocated headcount from this program
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id: programId } = await params;

  // T-04-22-adjacent read leak: the program info query below is not company-scoped
  // (it looks up by customers.id alone), so any caller could read another tenant's
  // program name and portfolio-level allocated headcount. Assert ownership first.
  try {
    await assertProgramAccess(programId, actorOf(user));
  } catch (e) {
    return serviceErrorResponse(e);
  }

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

  // T-04-22 live write IDOR fix: both sides must be proven owned by the caller
  // before the upsert — the program (maps to customers) AND the project.
  const actor = actorOf(user);
  try {
    await assertProgramAccess(programId, actor);
    await assertProjectAccess(project_id, actor);
  } catch (e) {
    return serviceErrorResponse(e);
  }

  const headcount = Math.max(0, Number(allocated_headcount) || 0);
  const id = await upsertProgramProjectAllocation(programId, project_id, headcount);
  return NextResponse.json({ id, project_id, allocated_headcount: headcount });
}
