import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { deleteJqlPreset } from '@/modules/jira/backend/services/jira-mapping.service';

export const DELETE = withAuth<{ id: string }>(async (_req, { actor, params }) => {
  await deleteJqlPreset(params.id, actor);
  return NextResponse.json({ ok: true });
});
