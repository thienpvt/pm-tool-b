import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { createBugMapping, listBugMappings } from '@/lib/services/import-mapping.service';
import { createBugMappingSchema } from './schema';

export const GET = withAuth(async (_req, { actor }) => {
  return NextResponse.json(await listBugMappings(actor));
});

export const POST = withAuth(async (_req, { actor, body }) => {
  const parsed = createBugMappingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const { name, mappings_json } = parsed.data;

  const row = await createBugMapping(
    actor,
    name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json(row, { status: 201 });
});
