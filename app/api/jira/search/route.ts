import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { integrationErrorResponse } from '@/lib/api-errors';
import { resolveJiraCredentials } from '@/lib/integrations/credentials';
import { searchIssues } from '@/lib/integrations/jira/client';

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user?.company_id) {
    // Behavior freeze (WR-01): a session with a null company is an authz
    // failure (401), matching the fields route — not a config-missing 503.
    return NextResponse.json(
      { error: 'Jira chưa được cấu hình cho công ty này. Admin cần vào trang Quản trị → Companies → Cấu hình Jira.' },
      { status: 401 }
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
