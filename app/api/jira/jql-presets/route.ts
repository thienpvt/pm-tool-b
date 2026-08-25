import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { createJqlPreset, listJqlPresets } from '@/lib/repositories/jira-config.repo';
import { createJqlPresetSchema } from './schema';

const MAX_PRESETS = 10;

export const GET = withAuth(async (req) => {
  const context = req.nextUrl.searchParams.get('context') ?? '';
  const rows = await listJqlPresets(context);
  return NextResponse.json(rows);
});

export const POST = withAuth(async (_req, { body }) => {
  const parsed = createJqlPresetSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Missing fields' }, { status: 400 });
  const { name, jql, context } = parsed.data;

  const ctx = context ?? '';
  const row = await createJqlPreset(name, jql, ctx, MAX_PRESETS);
  return NextResponse.json(row, { status: 201 });
});
