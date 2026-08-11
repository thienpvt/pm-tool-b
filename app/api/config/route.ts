import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { listSettings, setSetting } from '@/lib/repositories/settings.repo';
import { configSchema } from './schema';

export async function GET() {
  const rows = await listSettings();
  const config = Object.fromEntries(rows.map(r => [r.key, r.value]));
  // Mask the API key — only return whether it's set
  if (config.anthropic_api_key) {
    config.anthropic_api_key_set = 'true';
    config.anthropic_api_key = '***';
  }
  // Also check env var
  if (process.env.ANTHROPIC_API_KEY) {
    config.anthropic_api_key_set = 'env';
    config.anthropic_api_key = '***';
  }
  return NextResponse.json(config);
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const raw = await req.json();
  // Shape guard only — no per-field frozen validation exists to preserve.
  const parsed = configSchema.safeParse(raw);
  const body = parsed.success ? parsed.data : raw;
  for (const [key, value] of Object.entries(body)) {
    await setSetting(key, String(value));
  }
  return NextResponse.json({ ok: true });
}
