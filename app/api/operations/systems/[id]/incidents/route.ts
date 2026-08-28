import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  createIncidentForSystem,
  listIncidentsForSystem,
} from '@/lib/services/operations.service';
import { createOpsIncidentSchema } from './schema';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const incidents = await listIncidentsForSystem(user, id);
  if (incidents === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(incidents);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const parsed = createOpsIncidentSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const { title, severity, description, reported_at, resolved_at, cost_impact, status } = parsed.data;

  const created = await createIncidentForSystem(user, id, {
    title, severity, description, reported_at, resolved_at, cost_impact, status,
  });
  if (created === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(created, { status: 201 });
}
