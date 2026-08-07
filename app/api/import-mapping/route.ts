import { NextRequest, NextResponse } from 'next/server';
import { createTimelineMapping, listTimelineMappings } from '@/lib/repositories/import-mapping.repo';

export async function GET() {
  return NextResponse.json(await listTimelineMappings());
}

export async function POST(req: NextRequest) {
  const { name, mappings_json } = await req.json();
  if (!name || !mappings_json) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const row = await createTimelineMapping(
    name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json(row, { status: 201 });
}
