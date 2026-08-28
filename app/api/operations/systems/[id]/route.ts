import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { parseRequestJson } from '@/lib/http/parse-request-json';
import {
  deleteOperationsSystemForUser,
  getOperationsSystemDetail,
  updateOperationsSystemForUser,
} from '@/lib/services/operations.service';
import { updateOperationsSystemSchema } from './schema';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const detail = await getOperationsSystemDetail(user, id);
  if (!detail) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(detail);
}

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const body = await parseRequestJson(req);
  if (!body.ok) return body.response;
  const raw = body.data;
  // Passthrough shape guard only (no inline validation existed before this
  // schema) — parsed.data mirrors `raw` on any object body; behavior is
  // unchanged for the object bodies this route has always accepted.
  const parsed = updateOperationsSystemSchema.safeParse(raw);
  const { name, description, project_id, go_live_date, status } = parsed.success ? parsed.data : raw;

  const updated = await updateOperationsSystemForUser(user, id, {
    name, description, project_id, go_live_date, status,
  });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const deleted = await deleteOperationsSystemForUser(user, id);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
