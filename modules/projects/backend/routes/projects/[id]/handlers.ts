import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
  deleteProject,
  getProject,
  updateProject,
} from '@/modules/projects/backend/services/projects.service';

export async function getProjectHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(await getProject(params.id, actor));
}

export async function patchProjectHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(await updateProject(params.id, actor, body as Record<string, unknown>));
}

export async function deleteProjectHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  await deleteProject(params.id, actor);
  return NextResponse.json({ ok: true });
}
