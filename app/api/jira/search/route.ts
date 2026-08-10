import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { companyJiraConfig } from '@/lib/repositories/jira-config.repo';
import { integrationErrorResponse } from '@/lib/api-errors';
import { resolveJiraCredentials } from '@/lib/integrations/credentials';
import { searchIssues } from '@/lib/integrations/jira/client';

// INTG-08 / HYG-01: the old inline credential path is kept here as DEAD code
// (unreachable — POST resolves via resolveJiraCredentials below) so the cutover
// bisects to a dedicated deletion commit after scripts/verify-credential-cutover.ts
// reports every configured company matching. Delete this block in that commit.
// Gate blocked at execution time: no reachable DATABASE_URL, evidence outstanding.
async function getJiraCredentials(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user?.company_id) return null;

  const cfg = await companyJiraConfig(user.company_id);
  if (!cfg?.base_url_var || !cfg?.email_var || !cfg?.token_var) return null;

  const baseUrl = process.env[cfg.base_url_var]?.replace(/\/$/, '');
  const email   = process.env[cfg.email_var];
  const token   = process.env[cfg.token_var];
  if (!baseUrl || !email || !token) return null;

  return { baseUrl, email, token };
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user?.company_id) {
    return NextResponse.json(
      { error: 'Jira chưa được cấu hình cho công ty này. Admin cần vào trang Quản trị → Companies → Cấu hình Jira.' },
      { status: 503 }
    );
  }

  const creds = await resolveJiraCredentials(user.company_id);
  if (!creds) {
    return NextResponse.json(
      { error: 'Jira chưa được cấu hình cho công ty này. Admin cần vào trang Quản trị → Companies → Cấu hình Jira.' },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { jql, nextPageToken, maxResults = 100, extraFields = [] } = body as {
    jql: string;
    nextPageToken?: string;
    maxResults?: number;
    extraFields?: string[];
  };

  if (!jql) {
    return NextResponse.json({ error: 'jql là bắt buộc' }, { status: 400 });
  }

  try {
    const { issues, total, nextPageToken: token } = await searchIssues(creds, {
      jql,
      nextPageToken,
      maxResults,
      extraFields,
    });

    // Debug: log ALL custom fields from first issue to identify correct field IDs
    const firstIssue = issues[0] as { fields?: Record<string, unknown> } | undefined;
    if (firstIssue) {
      const customFields = Object.entries(firstIssue.fields ?? {})
        .filter(([k]) => k.startsWith('customfield_'))
        .map(([k, v]) => `${k}=${JSON.stringify(v)}`);
      console.log('[jira/search] custom fields on first issue:', customFields.join(' | '));
    }

    return NextResponse.json({
      issues,
      total,
      nextPageToken: token,
    });
  } catch (err) {
    return integrationErrorResponse(err);
  }
}
