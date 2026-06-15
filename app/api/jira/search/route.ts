import { NextRequest, NextResponse } from 'next/server';

function getJiraCredentials() {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;
  if (!baseUrl || !email || !token) {
    return null;
  }
  return { baseUrl, email, token };
}

function makeAuthHeader(email: string, token: string) {
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

export async function POST(req: NextRequest) {
  const creds = getJiraCredentials();
  if (!creds) {
    return NextResponse.json(
      { error: 'Jira chưa được cấu hình. Vui lòng set biến môi trường JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN.' },
      { status: 503 }
    );
  }

  const body = await req.json();
  const { jql, startAt = 0, maxResults = 100 } = body as {
    jql: string;
    startAt?: number;
    maxResults?: number;
  };

  if (!jql) {
    return NextResponse.json({ error: 'jql là bắt buộc' }, { status: 400 });
  }

  const fields = [
    'key', 'summary', 'issuetype', 'status', 'assignee', 'reporter',
    'priority', 'created', 'duedate', 'labels', 'components', 'parent',
    'customfield_10014', // Epic Link (classic)
    'customfield_10008', // Epic Name
    'customfield_10016', // Story Points
    'resolution',
    'customfield_10020', // Sprint (next-gen / team-managed)
  ].join(',');

  const url = `${creds.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${maxResults}&fields=${fields}`;

  try {
    const resp = await fetch(url, {
      headers: {
        Authorization: makeAuthHeader(creds.email, creds.token),
        Accept: 'application/json',
      },
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
      issues: data.issues ?? [],
      total: data.total ?? 0,
      startAt: data.startAt ?? 0,
      maxResults: data.maxResults ?? maxResults,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Lỗi kết nối Jira: ${msg}` }, { status: 500 });
  }
}
