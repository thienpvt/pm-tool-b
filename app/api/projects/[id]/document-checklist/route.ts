import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { listProjectDocumentChecklist } from '@/modules/documents/backend/services/project-document-checklist.service';

export const GET = withProjectAccess<{ id: string }>(async (_req, { params, actor }) =>
  NextResponse.json(await listProjectDocumentChecklist(params.id, actor)),
);
