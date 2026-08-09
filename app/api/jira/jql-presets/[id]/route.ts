import { NextRequest, NextResponse } from 'next/server';
import { deleteJqlPreset } from '@/lib/repositories/jira-config.repo';

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await deleteJqlPreset(id);
  return NextResponse.json({ ok: true });
}
