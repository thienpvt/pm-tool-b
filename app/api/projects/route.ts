import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse } from '@/lib/api-errors';
import { createProject, listProjects } from '@/lib/repositories/projects.repo';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json([], { status: 401 });

    return NextResponse.json(await listProjects(user.company_id, Boolean(user.is_admin)));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    // Only an admin may place a project in an arbitrary company; everyone else gets their own.
    const companyId = user.is_admin ? (body.company_id ?? null) : user.company_id;

    return NextResponse.json(await createProject(companyId, body), { status: 201 });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
