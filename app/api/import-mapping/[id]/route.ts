import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { deleteTimelineMapping, updateTimelineMapping } from '@/lib/repositories/import-mapping.repo';

export const DELETE = withAuth<{ id: string }>(async (_req, { params }) => {
  await deleteTimelineMapping(params.id);
  return NextResponse.json({ ok: true });
});

export const PUT = withAuth<{ id: string }>(async (_req, { params, body }) => {
  const { name, mappings_json } = body as { name: string; mappings_json: string | Record<string, unknown> };
  const row = await updateTimelineMapping(
    params.id,
    name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json(row);
});
