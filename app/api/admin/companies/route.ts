import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, forbidden, unauthorized } from '@/lib/auth';
import {
  createCompany,
  deleteCompany,
  listCompaniesWithUserCounts,
  updateCompany,
} from '@/lib/repositories/admin.repo';

async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}

export async function GET(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const companies = await listCompaniesWithUserCounts(null, true);
  return NextResponse.json(companies);
}

export async function POST(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });
  try {
    const newCompany = await createCompany(name.trim());
    return NextResponse.json(newCompany, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Company name already exists' }, { status: 409 });
  }
}

export async function PUT(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { id, name } = await req.json();
  if (!id || !name?.trim()) return NextResponse.json({ error: 'id and name required' }, { status: 400 });
  await updateCompany(id, name.trim());
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await deleteCompany(Number(id));
  return NextResponse.json({ ok: true });
}
