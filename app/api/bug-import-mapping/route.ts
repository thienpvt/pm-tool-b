import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { bugMappingIds, createBugMapping, deleteBugMapping, listBugMappings } from '@/lib/repositories/import-mapping.repo';
import { createBugMappingSchema } from './schema';

const MAX_TEMPLATES = 5;

export const GET = withAuth(async () => {
  return NextResponse.json(await listBugMappings());
});

export const POST = withAuth(async (_req, { body }) => {
  const parsed = createBugMappingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const { name, mappings_json } = parsed.data;

  const existing = await bugMappingIds();

  if (existing.length >= MAX_TEMPLATES) {
    const oldest = existing[existing.length - 1];
    await deleteBugMapping(oldest.id);
  }

  const row = await createBugMapping(
    name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json(row, { status: 201 });
});
