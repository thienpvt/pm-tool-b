import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest } from '@/lib/auth';

async function getJiraCredentials(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user?.company_id) return null;

  const db = await getDb();
  const cfg = await db.get<{ base_url_var: string; email_var: string; token_var: string }>(
    'SELECT base_url_var, email_var, token_var FROM company_jira_config WHERE company_id = ?',
    user.company_id,
  );
  if (!cfg?.base_url_var || !cfg?.email_var || !cfg?.token_var) return null;

  const baseUrl = process.env[cfg.base_url_var]?.replace(/\/$/, '');
  const email   = process.env[cfg.email_var];
  const token   = process.env[cfg.token_var];
  if (!baseUrl || !email || !token) return null;

  return { baseUrl, email, token };
}

function makeAuthHeader(email: string, token: string) {
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

const FIELDS = [
  'key', 'summary', 'issuetype', 'status', 'assignee', 'reporter',
  'priority', 'created', 'duedate', 'labels', 'components', 'parent',
  'customfield_10014', // Epic Link (classic)
  'customfield_10008', // Epic Name
  'customfield_10016', // Story Points
  'resolution',
  'customfield_10020', // Sprint (next-gen / team-managed)
  'customfield_1185',  // Severity (migrated)
];

export async function POST(req: NextRequest) {
  const creds = await getJiraCredentials(req);
  if (!creds) {
    return NextResponse.json(
      { error: 'Jira chưa được cấu hình cho công ty này. Admin cần vào trang Quản trị → Companies → Cấu hình Jira.' },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { jql, nextPageToken, maxResults = 100 } = body as {
    jql: string;
    nextPageToken?: string;
    maxResults?: number;
  };

  if (!jql) {
    return NextResponse.json({ error: 'jql là bắt buộc' }, { status: 400 });
  }

  // Jira Cloud new endpoint (POST /rest/api/3/search/jql), cursor-based pagination
  const requestBody: Record<string, unknown> = { jql, maxResults, fields: FIELDS };
  if (nextPageToken) requestBody.nextPageToken = nextPageToken;

  try {
    const resp = await fetch(`${creds.baseUrl}/rest/api/3/search/jql`, {
      method: 'POST',
      headers: {
        Authorization: makeAuthHeader(creds.email, creds.token),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg = `Jira trả về lỗi ${resp.status}`;
      try {
        const errJson = JSON.parse(errText);
        if (errJson.errorMessages?.length) errMsg = errJson.errorMessages.join('; ');
        else if (errJson.message) errMsg = errJson.message;
      } catch { /* keep default */ }
      return NextResponse.json({ error: errMsg }, { status: resp.status });
    }

    const data = await resp.json();
    return NextResponse.json({
      issues:        data.issues ?? [],
      total:         data.total ?? data.issues?.length ?? 0,
      nextPageToken: data.nextPageToken ?? null,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Lỗi kết nối Jira: ${msg}` }, { status: 500 });
  }
}
