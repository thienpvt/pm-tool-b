import { NextRequest, NextResponse } from 'next/server';
import { createJqlPreset, listJqlPresets } from '@/lib/repositories/jira-config.repo';
import { createJqlPresetSchema } from './schema';

const MAX_PRESETS = 10;

export async function GET(req: NextRequest) {
  const context = req.nextUrl.searchParams.get('context') ?? '';
  const rows = await listJqlPresets(context);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const parsed = createJqlPresetSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const { name, jql, context } = parsed.data;

  const ctx = context ?? '';
  const row = await createJqlPreset(name, jql, ctx, MAX_PRESETS);
  return NextResponse.json(row, { status: 201 });
}
