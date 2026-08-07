import { NextRequest, NextResponse } from 'next/server';
import { deleteTimelineMapping, updateTimelineMapping } from '@/lib/repositories/import-mapping.repo';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await deleteTimelineMapping(id);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { name, mappings_json } = await req.json();
  const row = await updateTimelineMapping(
    id,
    name,
    typeof mappings_json === 'string' ? mappings_json : JSON.stringify(mappings_json),
  );
  return NextResponse.json(row);
}
