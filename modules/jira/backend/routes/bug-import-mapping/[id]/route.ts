import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { deleteBugMapping } from '@/modules/jira/backend/services/import-mapping.service';

export const DELETE = withAuth<{ id: string }>(async (_req, { actor, params }) => {
  await deleteBugMapping(params.id, actor);
  return NextResponse.json({ ok: true });
});
