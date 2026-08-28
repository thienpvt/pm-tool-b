import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest, forbidden, unauthorized } from '@/lib/auth';
import { parseRequestJson } from '@/lib/http/parse-request-json';
import {
  deleteDemoRequestPlatform,
  listDemoRequestsPlatform,
  updateDemoRequestPlatform,
} from '@/modules/admin/backend/services/admin-platform.service';
import { updateDemoRequestSchema } from './schema';

async function requireAdmin(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return unauthorized();
  if (!user.is_admin) return forbidden();
  return null;
}

export async function GET(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const rows = await listDemoRequestsPlatform();
  return NextResponse.json(rows);
}

export async function PUT(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const body = await parseRequestJson(req);
  if (!body.ok) return body.response;
  const parsed = updateDemoRequestSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: 'id required' }, { status: 400 });
  const { id, status, notes } = parsed.data;
  await updateDemoRequestPlatform(id, status ?? null, notes ?? null);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const err = await requireAdmin(req); if (err) return err;
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });
  await deleteDemoRequestPlatform(Number(id));
  return NextResponse.json({ ok: true });
}
