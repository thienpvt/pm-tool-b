import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse } from '@/lib/api-errors';
import { toAccessActor } from '@/lib/services/access';
import { createProject, listProjects } from '@/modules/projects/backend/services/projects.service';

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json([], { status: 401 });

    return NextResponse.json(await listProjects(toAccessActor(user)));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const actor = toAccessActor(user);

    return NextResponse.json(await createProject(actor, body), { status: 201 });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
