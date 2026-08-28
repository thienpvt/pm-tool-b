import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { parseRequestJson } from '@/lib/http/parse-request-json';
import {
  createOperationsSystem,
  listOperationsSystems,
} from '@/modules/operations/backend/services/operations.service';
import { createOperationsSystemSchema } from './schema';

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const systems = await listOperationsSystems(user);
  return NextResponse.json(systems);
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await parseRequestJson(req);
  if (!body.ok) return body.response;
  const parsed = createOperationsSystemSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const { name, description, project_id, go_live_date, status } = parsed.data;

  const created = await createOperationsSystem(user, {
    project_id, name, description, go_live_date, status,
  });
  return NextResponse.json(created, { status: 201 });
}
