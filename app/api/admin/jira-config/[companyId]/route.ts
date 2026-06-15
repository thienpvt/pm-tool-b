import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';

type Params = { params: Promise<{ companyId: string }> };

async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return { err: unauthorized(), user: null };
  if (!user.is_admin) return { err: forbidden(), user: null };
  return { err: null, user };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { companyId } = await params;
  const db = await getDb();
  const row = await db.get<{ base_url_var: string; email_var: string; token_var: string }>(
    'SELECT base_url_var, email_var, token_var FROM company_jira_config WHERE company_id = ?',
    Number(companyId),
  );
  return NextResponse.json(row ?? { base_url_var: '', email_var: '', token_var: '' });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { companyId } = await params;
  const { base_url_var, email_var, token_var } = await req.json() as {
    base_url_var: string; email_var: string; token_var: string;
  };

  const db = await getDb();
  await db.run(
    `INSERT INTO company_jira_config (company_id, base_url_var, email_var, token_var)
     VALUES (?, ?, ?, ?)
     ON CONFLICT (company_id) DO UPDATE SET
       base_url_var = excluded.base_url_var,
       email_var    = excluded.email_var,
       token_var    = excluded.token_var`,
    Number(companyId),
    (base_url_var ?? '').trim(),
    (email_var ?? '').trim(),
    (token_var ?? '').trim(),
  );
  return NextResponse.json({ ok: true });
}
