import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse, serviceErrorResponse } from '@/lib/api-errors';
import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { deleteProject, getProject, updateProject } from '@/lib/services/projects.service';

type Params = { params: Promise<{ id: string }> };

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

function mapError(e: unknown) {
  // Rejected column must stay a 400 naming the column, not a generic 500 or 403 (T-04-25).
  if (e instanceof UnknownColumnError) return repoErrorResponse(e);
  return serviceErrorResponse(e);
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await getProject(id, actorOf(user)));
  } catch (e) {
    return mapError(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    return NextResponse.json(await updateProject(id, actorOf(user), body));
  } catch (e) {
    return mapError(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await deleteProject(id, actorOf(user));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return mapError(e);
  }
}
