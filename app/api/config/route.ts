import { NextRequest, NextResponse } from 'next/server';
import { listSettings, setSetting } from '@/lib/repositories/settings.repo';

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
  const body = await req.json();
  for (const [key, value] of Object.entries(body)) {
    await setSetting(key, String(value));
  }
  return NextResponse.json({ ok: true });
}
