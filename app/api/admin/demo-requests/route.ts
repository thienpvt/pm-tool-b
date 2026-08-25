import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, forbidden, unauthorized } from '@/lib/auth';
import { deleteDemoRequest, listDemoRequests, updateDemoRequest } from '@/lib/repositories/admin.repo';
import { updateDemoRequestSchema } from './schema';

async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}

export async function GET(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const rows = await listDemoRequests();
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const parsed = updateDemoRequestSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { id, status, notes } = parsed.data;
  await updateDemoRequest(id, status ?? null, notes ?? null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await deleteDemoRequest(Number(id));
  return NextResponse.json({ ok: true });
}
