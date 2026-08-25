import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { listSettings, setSetting } from '@/lib/repositories/settings.repo';
import { configSchema } from './schema';

// HYG-02: GET was previously anonymous (no session check) — now session-gated
// via withAuth (401 without a session). Masking logic unchanged.
export const GET = withAuth(async () => {
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
});

// withAuth covers 401; the is_admin 403 check stays inside the handler
// (don't double-gate at the wrapper level — T-06-16).
export const POST = withAuth(async (_req, { user, body }) => {
  if (!user.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  // Shape guard only — no per-field frozen validation exists to preserve.
  const parsed = configSchema.safeParse(body);
  const parsedBody = parsed.success ? parsed.data : (body as Record<string, unknown>);
  for (const [key, value] of Object.entries(parsedBody)) {
    await setSetting(key, String(value));
  }
  return NextResponse.json({ ok: true });
});
