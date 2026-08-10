import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { integrationErrorResponse } from '@/lib/api-errors';
import { companyJiraConfig } from '@/lib/repositories/jira-config.repo';
import { resolveJiraCredentials } from '@/lib/integrations/credentials';
import { listFields } from '@/lib/integrations/jira/client';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user?.company_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Distinguish the two 503 cases the route emits today: no saved config vs
  // config saved but env values missing. The resolver collapses both to null,
  // so the config-row presence check lives here (no credential resolution).
  const cfg = await companyJiraConfig(user.company_id);
  if (!cfg?.base_url_var) return NextResponse.json({ error: 'Jira chưa cấu hình' }, { status: 503 });

  const creds = await resolveJiraCredentials(user.company_id);
  if (!creds) return NextResponse.json({ error: 'Thiếu env vars' }, { status: 503 });

  try {
    const customFields = await listFields(creds);
    return NextResponse.json(customFields);
  } catch (err) {
    return integrationErrorResponse(err);
  }
}

// INTG-08 / HYG-01: old inline credential path kept as DEAD code (unreachable —
// GET resolves via resolveJiraCredentials above) so the cutover bisects to a
// dedicated deletion commit after scripts/verify-credential-cutover.ts reports
// every configured company matching. Delete this block in that commit.
// Gate blocked at execution time: no reachable DATABASE_URL, evidence outstanding.
async function oldInlineCredentialBlock(_user: { company_id: number | null }) {
  const cfg = await companyJiraConfig(_user.company_id);
  if (!cfg?.base_url_var) return null;
  const baseUrl = process.env[cfg.base_url_var]?.replace(/\/$/, '');
  const email = process.env[cfg.email_var];
  const token = process.env[cfg.token_var];
  if (!baseUrl || !email || !token) return null;
  const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
  return { baseUrl, email, token, auth };
}
