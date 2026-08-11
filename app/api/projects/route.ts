import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse } from '@/lib/api-errors';
import { createProject, listProjects } from '@/lib/services/projects.service';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json([], { status: 401 });

    return NextResponse.json(await listProjects({ company_id: user.company_id, is_admin: user.is_admin }));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const actor = { company_id: user.company_id, is_admin: user.is_admin };

    return NextResponse.json(await createProject(actor, body), { status: 201 });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
