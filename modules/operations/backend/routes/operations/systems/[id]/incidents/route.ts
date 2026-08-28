import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { parseRequestJson } from '@/lib/http/parse-request-json';
import {
  createIncidentForSystem,
  listIncidentsForSystem,
} from '@/modules/operations/backend/services/operations.service';
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

  const body = await parseRequestJson(req);
  if (!body.ok) return body.response;
  const parsed = createOpsIncidentSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: 'title required' }, { status: 400 });
  const { title, severity, description, reported_at, resolved_at, cost_impact, status } = parsed.data;

  const created = await createIncidentForSystem(user, id, {
    title, severity, description, reported_at, resolved_at, cost_impact, status,
  });
  if (created === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(created, { status: 201 });
}
