import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  const db = getDb();
  const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
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
  const db = getDb();
  for (const [key, value] of Object.entries(body)) {
    db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
      .run(key, String(value));
  }
  return NextResponse.json({ ok: true });
}
