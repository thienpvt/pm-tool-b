import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, unauthorized, forbidden } from '@/lib/auth';
import { parseRequestJson } from '@/lib/http/parse-request-json';
import { parsePositiveIntRouteParam } from '@/lib/http/parse-route-param';
import {
  getCompanyJiraConfigOrEmpty,
  setCompanyJiraConfigVars,
} from '@/modules/admin/backend/services/jira-config.service';
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
  const companyIdNum = parsePositiveIntRouteParam(companyId);
  if (companyIdNum === null) {
    return NextResponse.json({ error: 'Invalid company id' }, { status: 400 });
  }
  const row = await getCompanyJiraConfigOrEmpty(companyIdNum);
  return NextResponse.json(row);
}

export async function POST(req: NextRequest, { params }: Params) {
  const { err } = await requireAdmin(req);
  if (err) return err;

  const { companyId } = await params;
  const companyIdNum = parsePositiveIntRouteParam(companyId);
  if (companyIdNum === null) {
    return NextResponse.json({ error: 'Invalid company id' }, { status: 400 });
  }
  const body = await parseRequestJson(req);
  if (!body.ok) return body.response;
  const raw = body.data;
  const parsed = jiraConfigSchema.safeParse(raw);
  const { base_url_var, email_var, token_var } = (parsed.success ? parsed.data : raw) as {
    base_url_var: string; email_var: string; token_var: string;
  };

  await setCompanyJiraConfigVars(companyIdNum, {
    base_url_var: base_url_var ?? '', email_var: email_var ?? '', token_var: token_var ?? '',
  });
  return NextResponse.json({ ok: true });
}
