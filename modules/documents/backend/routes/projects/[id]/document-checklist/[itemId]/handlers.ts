import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import type { ProjectAccessRow } from '@/modules/projects/backend/repositories/projects.repo';
import {
  getChecklistItem,
  patchChecklistItem,
} from '@/modules/documents/backend/services/project-document-checklist.service';

export async function getChecklistItemHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string; itemId: string }> & { project: ProjectAccessRow },
) {
  return NextResponse.json(await getChecklistItem(params.id, params.itemId, actor));
}

export async function patchChecklistItemHandler(
  _req: NextRequest,
  {
    params,
    actor,
    body,
  }: HandlerContext<{ id: string; itemId: string }> & { project: ProjectAccessRow },
) {
  return NextResponse.json(
    await patchChecklistItem(params.id, params.itemId, actor, body as Record<string, unknown>),
  );
}
