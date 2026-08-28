import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  deleteIncidentForSystem,
  updateIncidentForSystem,
} from '@/lib/services/operations.service';

type Params = { params: Promise<{ id: string; incId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, incId } = await params;
  const body = await req.json();
  const { title, severity, description, reported_at, resolved_at, cost_impact, status } = body;

  const updated = await updateIncidentForSystem(user, id, incId, {
    title, severity, description, reported_at, resolved_at, cost_impact, status,
  });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, incId } = await params;
  const deleted = await deleteIncidentForSystem(user, id, incId);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
