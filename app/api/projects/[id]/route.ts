import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse } from '@/lib/api-errors';
import { deleteProject, getProject, projectAccessRow, updateProject } from '@/lib/repositories/projects.repo';

type Params = { params: Promise<{ id: string }> };

async function checkAccess(req: NextRequest, projectId: string) {
  const user = await getSessionFromRequest(req);
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
  if (user.is_admin) return { error: null, user };

  const project = await projectAccessRow(projectId);
  if (!project) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }), user: null };
  const allowed = project.company_id === user.company_id || project.customer_company_id === user.company_id;
  if (!allowed) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), user: null };
  return { error: null, user };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await checkAccess(req, id);
  if (error) return error;
  try {
    const project = await getProject(id);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(project);
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await checkAccess(req, id);
  if (error) return error;
  try {
    const body = await req.json();
    return NextResponse.json(await updateProject(id, body));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { error } = await checkAccess(req, id);
  if (error) return error;
  try {
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
