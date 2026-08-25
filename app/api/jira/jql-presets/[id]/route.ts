import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { deleteJqlPreset } from '@/lib/repositories/jira-config.repo';

export const DELETE = withAuth<{ id: string }>(async (_req, { params }) => {
  await deleteJqlPreset(params.id);
  return NextResponse.json({ ok: true });
});
