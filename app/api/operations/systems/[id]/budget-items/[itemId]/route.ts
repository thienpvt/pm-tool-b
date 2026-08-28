import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { parseRequestJson } from '@/lib/http/parse-request-json';
import {
  deleteBudgetItemForSystem,
  updateBudgetItemForSystem,
} from '@/lib/services/operations.service';

type Params = { params: Promise<{ id: string; itemId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, itemId } = await params;
  const body = await parseRequestJson(req);
  if (!body.ok) return body.response;
  const { category, name, planned_amount, actual_amount, unit, period_label, notes } = body.data as Record<string, unknown>;

  const updated = await updateBudgetItemForSystem(user, id, itemId, {
    category, name, planned_amount, actual_amount, unit, period_label, notes,
  });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, itemId } = await params;
  const deleted = await deleteBudgetItemForSystem(user, id, itemId);
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  return NextResponse.json({ ok: true });
}
