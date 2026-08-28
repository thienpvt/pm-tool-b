import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { parseRequestJson } from '@/lib/http/parse-request-json';
import {
  deleteIncidentForSystem,
  updateIncidentForSystem,
} from '@/modules/operations/backend/services/operations.service';

type Params = { params: Promise<{ id: string; incId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, incId } = await params;
  const body = await parseRequestJson(req);
  if (!body.ok) return body.response;
  const { title, severity, description, reported_at, resolved_at, cost_impact, status } = body.data as Record<string, unknown>;

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
