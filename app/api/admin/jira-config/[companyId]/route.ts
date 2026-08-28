import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { parseRequestJson } from '@/lib/http/parse-request-json';
import {
  getCompanyJiraConfigOrEmpty,
  setCompanyJiraConfigVars,
} from '@/lib/services/jira-config.service';
import { jiraConfigSchema } from './schema';

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
  const row = await getCompanyJiraConfigOrEmpty(Number(companyId));
  return NextResponse.json(row);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { companyId } = await params;
  const body = await parseRequestJson(req);
  if (!body.ok) return body.response;
  const raw = body.data;
  const parsed = jiraConfigSchema.safeParse(raw);
  const { base_url_var, email_var, token_var } = (parsed.success ? parsed.data : raw) as {
    base_url_var: string; email_var: string; token_var: string;
  };

  await setCompanyJiraConfigVars(Number(companyId), {
    base_url_var: base_url_var ?? '', email_var: email_var ?? '', token_var: token_var ?? '',
  });
  return NextResponse.json({ ok: true });
}
