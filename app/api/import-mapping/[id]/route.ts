import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { deleteTimelineMapping, updateTimelineMapping } from '@/lib/services/import-mapping.service';

export const DELETE = withAuth<{ id: string }>(async (_req, { actor, params }) => {
  await deleteTimelineMapping(params.id, actor);
  return NextResponse.json({ ok: true });
});

export const PUT = withAuth<{ id: string }>(async (_req, { actor, params, body }) => {
  const { name, mappings_json } = body as { name: string; mappings_json: string | Record<string, unknown> };
  const row = await updateTimelineMapping(
    params.id,
    actor,
    name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json(row);
});
