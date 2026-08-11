import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import {
  listRecentJiraSyncMappings,
  saveJiraSyncMapping,
} from '@/lib/repositories/jira-config.repo';
import { syncMappingSchema } from './schema';

export const GET = withAuth(async () => {
  const rows = await listRecentJiraSyncMappings();
  return NextResponse.json(rows);
});

export const POST = withAuth(async (_req, { body }) => {
  const parsed = syncMappingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Missing mappings_json' }, { status: 400 });
  const { mappings_json } = parsed.data;
  await saveJiraSyncMapping(
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json({ ok: true });
});
