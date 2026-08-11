import { NextRequest, NextResponse } from 'next/server';
import {
  listRecentJiraSyncMappings,
  saveJiraSyncMapping,
} from '@/lib/repositories/jira-config.repo';
import { syncMappingSchema } from './schema';

export async function GET() {
  const rows = await listRecentJiraSyncMappings();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const parsed = syncMappingSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Missing mappings_json' }, { status: 400 });
  const { mappings_json } = parsed.data;
  await saveJiraSyncMapping(
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json({ ok: true });
}
