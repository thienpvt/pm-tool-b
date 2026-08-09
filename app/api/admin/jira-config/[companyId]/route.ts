import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { companyJiraConfig, setCompanyJiraConfig } from '@/lib/repositories/jira-config.repo';

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
  const row = await companyJiraConfig(Number(companyId));
  return NextResponse.json(row ?? { base_url_var: '', email_var: '', token_var: '' });
}

export async function POST(req: NextRequest, { params }: Params) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { companyId } = await params;
  const { base_url_var, email_var, token_var } = await req.json() as {
    base_url_var: string; email_var: string; token_var: string;
  };

  await setCompanyJiraConfig(Number(companyId), {
    base_url_var: base_url_var ?? '', email_var: email_var ?? '', token_var: token_var ?? '',
  });
  return NextResponse.json({ ok: true });
}
