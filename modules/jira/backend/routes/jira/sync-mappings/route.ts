import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import {
  listRecentJiraSyncMappings,
  saveJiraSyncMapping,
} from '@/modules/jira/backend/services/jira-mapping.service';
import { syncMappingSchema } from './schema';

export const GET = withAuth(async (_req, { actor }) => {
  const rows = await listRecentJiraSyncMappings(actor);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (_req, { actor, body }) => {
  const parsed = syncMappingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Missing mappings_json' }, { status: 400 });
  const { mappings_json } = parsed.data;
  await saveJiraSyncMapping(
    actor,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json({ ok: true });
});
