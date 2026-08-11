import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, forbidden, unauthorized, hashPassword } from '@/lib/auth';
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  setAdminUserPassword,
  updateAdminUser,
} from '@/lib/repositories/admin.repo';
import { createUserSchema, updateUserSchema } from './schema';

async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}

export async function GET(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const users = await listAdminUsers(null, true);
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const parsed = createUserSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
  }
  const { username, password, display_name, company_id, is_admin } = parsed.data;
  try {
    const newUser = await createAdminUser(
      username.trim(), hashPassword(password), display_name ?? '',
      (company_id ?? null) as number | null, Boolean(is_admin),
    );
    return NextResponse.json(newUser, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
  }
}

export async function PUT(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const parsed = updateUserSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { id, display_name, company_id, is_admin, password } = parsed.data;
  if (password) {
    await setAdminUserPassword(id, hashPassword(password));
  }
  await updateAdminUser(id, display_name ?? '', (company_id ?? null) as number | null, Boolean(is_admin));
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const self = await getSessionFromRequest(req);
  if (self?.id === Number(id)) return NextResponse.json({ error: 'Cannot delete yourself' }, { status: 400 });
  await deleteAdminUser(Number(id));
  return NextResponse.json({ ok: true });
}
