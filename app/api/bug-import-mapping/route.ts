import { NextRequest, NextResponse } from 'next/server';
import { bugMappingIds, createBugMapping, deleteBugMapping, listBugMappings } from '@/lib/repositories/import-mapping.repo';
import { createBugMappingSchema } from './schema';

const MAX_TEMPLATES = 5;

export async function GET() {
  return NextResponse.json(await listBugMappings());
}

export async function POST(req: NextRequest) {
  const parsed = createBugMappingSchema.safeParse(await req.json());
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
}
