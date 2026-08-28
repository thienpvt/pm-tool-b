import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { createTimelineMapping, listTimelineMappings } from '@/lib/services/import-mapping.service';
import { createTimelineMappingSchema } from './schema';

export const GET = withAuth(async (_req, { actor }) => {
  return NextResponse.json(await listTimelineMappings(actor));
});

export const POST = withAuth(async (_req, { actor, body }) => {
  const parsed = createTimelineMappingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const { name, mappings_json } = parsed.data;
  const row = await createTimelineMapping(
    actor,
    name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json(row, { status: 201 });
});
