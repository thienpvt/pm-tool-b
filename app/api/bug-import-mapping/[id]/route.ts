import { NextRequest, NextResponse } from 'next/server';
import { deleteBugMapping } from '@/lib/repositories/import-mapping.repo';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await deleteBugMapping(id);
  return NextResponse.json({ ok: true });
}
