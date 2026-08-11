import { NextRequest, NextResponse } from 'next/server';
import { createTimelineMapping, listTimelineMappings } from '@/lib/repositories/import-mapping.repo';
import { createTimelineMappingSchema } from './schema';

export async function GET() {
  return NextResponse.json(await listTimelineMappings());
}

export async function POST(req: NextRequest) {
  const parsed = createTimelineMappingSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const { name, mappings_json } = parsed.data;
  const row = await createTimelineMapping(
    name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json(row, { status: 201 });
}
