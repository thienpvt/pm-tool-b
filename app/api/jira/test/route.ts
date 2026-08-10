import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { integrationErrorResponse } from '@/lib/api-errors';
import { companyJiraConfig } from '@/lib/repositories/jira-config.repo';
import { resolveJiraCredentials } from '@/lib/integrations/credentials';
import { testConnection } from '@/lib/integrations/jira/client';

type Cfg = { base_url_var: string; email_var: string; token_var: string };

/**
 * Resolve which env-var names to test:
 *  - Admin can pass a body with companyId and/or the var names being edited in the
 *    config dialog → test those, even before they're saved.
 *  - Otherwise fall back to the logged-in user's own company config (saved in DB).
 *
 * Returns the names only — actual values are resolved by resolveJiraCredentials,
 * which serves both this path and the DB-config path (Pitfall 3). The resolver's
 * null return carries no per-name detail, so the missing-var diagnostic below is
 * computed from the names against process.env, exactly as before.
 */
async function resolveCfg(req: NextRequest): Promise<
  | { ok: true; cfg: Cfg }
  | { ok: false; status: number; error: string }
> {
  const user = await getSessionFromRequest(req);
  if (!user) return { ok: false, status: 401, error: 'Chưa đăng nhập' };

  // POST → admin testing a specific company / un-saved form values.
  let body: Partial<Cfg> & { companyId?: number } = {};
  if (req.method === 'POST') {
    try { body = await req.json(); } catch { /* empty body is fine */ }
  }

  // If admin supplied the form var names directly, use them as-is.
  if (user.is_admin && body.base_url_var && body.email_var && body.token_var) {
    return { ok: true, cfg: { base_url_var: body.base_url_var, email_var: body.email_var, token_var: body.token_var } };
  }

  // Otherwise read saved config for the target company.
  const companyId = (user.is_admin && body.companyId) ? Number(body.companyId) : user.company_id;
  if (!companyId) return { ok: false, status: 400, error: 'Tài khoản chưa thuộc công ty nào' };

  const cfg = await companyJiraConfig(companyId);
  if (!cfg?.base_url_var || !cfg?.email_var || !cfg?.token_var) {
    return { ok: false, status: 503, error: 'Công ty chưa được cấu hình Jira. Admin vào Quản trị → Companies → Cấu hình Jira.' };
  }
  return { ok: true, cfg };
}

async function handle(req: NextRequest) {
  const resolved = await resolveCfg(req);
  if (!resolved.ok) return NextResponse.json({ ok: false, error: resolved.error }, { status: resolved.status });
  const { cfg } = resolved;

  const baseUrl = process.env[cfg.base_url_var]?.replace(/\/$/, '');
  const email   = process.env[cfg.email_var];
  const token   = process.env[cfg.token_var];

  if (!baseUrl || !email || !token) {
    const missing = [
      !baseUrl && cfg.base_url_var,
      !email   && cfg.email_var,
      !token   && cfg.token_var,
    ].filter(Boolean);
    return NextResponse.json({
      ok: false,
      error: `Biến môi trường chưa được set trên Railway: ${missing.join(', ')}`,
      missing,
    }, { status: 503 });
  }

  const creds = { baseUrl, email, token };

  try {
    const me = await testConnection(creds);
    return NextResponse.json({
      ok: true,
      displayName: me.displayName,
      email: me.emailAddress,
      accountId: me.accountId,
      baseUrl,
    });
  } catch (err) {
    const e = err as { kind?: string; status?: number; message?: string };
    // Route-level handling wins here: the test route's response shapes and the
    // `Lỗi kết nối: ...` 500 prefix differ from the search route's mapper
    // output, so the upstream/network cases are rendered with the test prefix.
    // WR-04: the upstream `e.message` is the raw Jira error body echoed to the
    // operator. Deliberate — behavior freeze (the old route echoed `j.message`
    // verbatim) and the test route is an operator diagnostic where the upstream
    // reason is the point. The network/timeout branch only ever sees the
    // client's generated message ('IntegrationError[jira:network]'), never raw
    // upstream text.
    const upstreamMsg = typeof e.message === 'string' ? e.message : 'Lỗi kết nối Jira';
    if (e.kind === 'upstream') {
      return NextResponse.json({ ok: false, error: upstreamMsg }, { status: e.status ?? 500 });
    }
    if (e.kind === 'network' || e.kind === 'timeout') {
      return NextResponse.json({ ok: false, error: `Lỗi kết nối: ${upstreamMsg}` }, { status: 500 });
    }
    return integrationErrorResponse(err);
  }
}

// GET: test the logged-in user's own (saved) company config.
export const GET = handle;
// POST: admin tests a specific company / un-saved form values.
export const POST = handle;
