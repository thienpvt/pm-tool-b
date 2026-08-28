import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { parseRequestJson } from '@/lib/http/parse-request-json';
import {
  createBudgetItemForSystem,
  listBudgetItemsForSystem,
} from '@/lib/services/operations.service';
import { createOpsBudgetItemSchema } from './schema';

type Params = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const items = await listBudgetItemsForSystem(user, id);
  if (items === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const body = await parseRequestJson(req);
  if (!body.ok) return body.response;
  const parsed = createOpsBudgetItemSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const { category, name, planned_amount, actual_amount, unit, period_label, notes } = parsed.data;

  const created = await createBudgetItemForSystem(user, id, {
    category, name, planned_amount, actual_amount, unit, period_label, notes,
  });
  if (created === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json(created, { status: 201 });
}
