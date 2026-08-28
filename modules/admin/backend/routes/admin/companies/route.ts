import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, forbidden, unauthorized } from '@/lib/auth';
import { parseRequestJson } from '@/lib/http/parse-request-json';
import { serviceErrorResponse } from '@/lib/api-errors';
import {
  createCompanyPlatform,
  deleteCompanyPlatform,
  listCompaniesPlatform,
  updateCompanyPlatform,
} from '@/modules/admin/backend/services/admin-platform.service';
import { createCompanySchema, updateCompanySchema } from './schema';

async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}

export async function GET(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const companies = await listCompaniesPlatform();
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const body = await parseRequestJson(req);
  if (!body.ok) return body.response;
  const parsed = createCompanySchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  const { name } = parsed.data;
  try {
    const newCompany = await createCompanyPlatform(name);
    return NextResponse.json(newCompany, { status: 201 });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function PUT(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const body = await parseRequestJson(req);
  if (!body.ok) return body.response;
  const parsed = updateCompanySchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: 'id and name required' }, { status: 400 });
  const { id, name } = parsed.data;
  await updateCompanyPlatform(id, name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await deleteCompanyPlatform(Number(id));
  return NextResponse.json({ ok: true });
}
