import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { companyJiraConfig } from '@/lib/repositories/jira-config.repo';

type Cfg = { base_url_var: string; email_var: string; token_var: string };

/**
 * Resolve which env-var names to test:
 *  - Admin can pass a body with companyId and/or the var names being edited in the
 *    config dialog → test those, even before they're saved.
 *  - Otherwise fall back to the logged-in user's own company config (saved in DB).
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

  const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');

  try {
    const resp = await fetch(`${baseUrl}/rest/api/3/myself`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg = `Jira trả về ${resp.status}`;
      try { const j = JSON.parse(errText); if (j.message) errMsg = j.message; } catch { /* keep */ }
      return NextResponse.json({ ok: false, error: errMsg }, { status: resp.status });
    }

    const me = await resp.json();
    return NextResponse.json({
      ok: true,
      displayName: me.displayName,
      email: me.emailAddress,
      accountId: me.accountId,
      baseUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: `Lỗi kết nối: ${msg}` }, { status: 500 });
  }
}

// GET: test the logged-in user's own (saved) company config.
export const GET = handle;
// POST: admin tests a specific company / un-saved form values.
export const POST = handle;
