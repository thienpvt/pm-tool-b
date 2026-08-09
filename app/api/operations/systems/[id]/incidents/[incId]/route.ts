import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  deleteOperationsIncident,
  findOperationsSystem,
  updateOperationsIncident,
} from '@/lib/repositories/operations.repo';

type Params = { params: Promise<{ id: string; incId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, incId } = await params;
  const sys = await findOperationsSystem(id, user.company_id, Boolean(user.is_admin));
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { title, severity, description, reported_at, resolved_at, cost_impact, status } = body;

  const updated = await updateOperationsIncident(id, incId, {
    title, severity, description, reported_at, resolved_at, cost_impact, status,
  });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, incId } = await params;
  const sys = await findOperationsSystem(id, user.company_id, Boolean(user.is_admin));
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await deleteOperationsIncident(id, incId);
  return NextResponse.json({ ok: true });
}
