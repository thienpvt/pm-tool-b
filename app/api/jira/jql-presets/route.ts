import { NextRequest, NextResponse } from 'next/server';
import { createJqlPreset, listJqlPresets } from '@/lib/repositories/jira-config.repo';

const MAX_PRESETS = 10;

export async function GET(req: NextRequest) {
  const context = req.nextUrl.searchParams.get('context') ?? '';
  const rows = await listJqlPresets(context);
  return NextResponse.json(rows);
}

export async function POST(req: NextRequest) {
  const { name, jql, context } = await req.json();
  if (!name || !jql) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });

  const ctx = context ?? '';
  const row = await createJqlPreset(name, jql, ctx, MAX_PRESETS);
  return NextResponse.json(row, { status: 201 });
}
