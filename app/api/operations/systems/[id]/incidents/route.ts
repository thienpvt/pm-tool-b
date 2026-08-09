import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  createOperationsIncident,
  findOperationsSystem,
  listOperationsIncidents,
} from '@/lib/repositories/operations.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const sys = await findOperationsSystem(id, user.company_id, Boolean(user.is_admin));
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const incidents = await listOperationsIncidents(id);
  return NextResponse.json(incidents);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const sys = await findOperationsSystem(id, user.company_id, Boolean(user.is_admin));
  if (!sys) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json();
  const { title, severity, description, reported_at, resolved_at, cost_impact, status } = body;
  if (!title) return NextResponse.json({ error: 'title required' }, { status: 400 });

  const created = await createOperationsIncident(id, {
    title, severity, description, reported_at, resolved_at, cost_impact, status,
  });
  return NextResponse.json(created, { status: 201 });
}
