import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import type { ProjectAccessRow } from '@/lib/repositories/projects.repo';
import { listProjectDocumentChecklist } from '@/modules/documents/backend/services/project-document-checklist.service';

export async function getProjectDocumentChecklistHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }> & { project: ProjectAccessRow },
) {
  return NextResponse.json(await listProjectDocumentChecklist(params.id, actor));
}
