import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { deleteBugMapping } from '@/lib/repositories/import-mapping.repo';

export const DELETE = withAuth<{ id: string }>(async (_req, { params }) => {
  await deleteBugMapping(params.id);
  return NextResponse.json({ ok: true });
});
