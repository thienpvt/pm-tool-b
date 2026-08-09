import { NextRequest, NextResponse } from 'next/server';
import {
  listRecentJiraSyncMappings,
  saveJiraSyncMapping,
} from '@/lib/repositories/jira-config.repo';

export async function GET() {
  const rows = await listRecentJiraSyncMappings();
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { mappings_json } = await req.json();
  if (!mappings_json) return NextResponse.json({ error: 'Missing mappings_json' }, { status: 400 });
  await saveJiraSyncMapping(
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json({ ok: true });
}
