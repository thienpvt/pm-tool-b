import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { companyJiraConfig } from '@/lib/repositories/jira-config.repo';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user?.company_id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const cfg = await companyJiraConfig(user.company_id);
  if (!cfg?.base_url_var) return NextResponse.json({ error: 'Jira chưa cấu hình' }, { status: 503 });

  const baseUrl = process.env[cfg.base_url_var]?.replace(/\/$/, '');
  const email   = process.env[cfg.email_var];
  const token   = process.env[cfg.token_var];
  if (!baseUrl || !email || !token) return NextResponse.json({ error: 'Thiếu env vars' }, { status: 503 });

  const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');

  const resp = await fetch(`${baseUrl}/rest/api/3/field`, {
    headers: { Authorization: auth, Accept: 'application/json' },
  });

  if (!resp.ok) return NextResponse.json({ error: `Jira error ${resp.status}` }, { status: resp.status });

  const fields = await resp.json() as Array<{ id: string; name: string; custom: boolean; schema?: { type: string } }>;
  // Return only custom fields, sorted by name
  const customFields = fields
    .filter(f => f.custom)
    .map(f => ({ id: f.id, name: f.name, type: f.schema?.type ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json(customFields);
}
