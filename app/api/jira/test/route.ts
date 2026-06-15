import { NextResponse } from 'next/server';

export async function GET() {
  const baseUrl = process.env.JIRA_BASE_URL?.replace(/\/$/, '');
  const email = process.env.JIRA_EMAIL;
  const token = process.env.JIRA_API_TOKEN;

  if (!baseUrl || !email || !token) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Thiếu biến môi trường. Cần set: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN',
        missing: [
          !baseUrl && 'JIRA_BASE_URL',
          !email && 'JIRA_EMAIL',
          !token && 'JIRA_API_TOKEN',
        ].filter(Boolean),
      },
      { status: 503 }
    );
  }

  const auth = 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');

  try {
    const resp = await fetch(`${baseUrl}/rest/api/3/myself`, {
      headers: { Authorization: auth, Accept: 'application/json' },
    });

    if (!resp.ok) {
      const errText = await resp.text();
      let errMsg = `Jira trả về ${resp.status}`;
      try {
        const j = JSON.parse(errText);
        if (j.message) errMsg = j.message;
      } catch { /* keep default */ }
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
