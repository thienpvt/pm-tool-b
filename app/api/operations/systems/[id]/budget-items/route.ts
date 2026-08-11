import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  createOperationsBudgetItem,
  findOperationsSystem,
  listOperationsBudgetItems,
} from '@/lib/repositories/operations.repo';
import { createOpsBudgetItemSchema } from './schema';

type Params = { params: Promise<{ id: string }> };

async function verifySystem(sysId: string, companyId: number | null, isAdmin: boolean) {
  return findOperationsSystem(sysId, companyId, isAdmin);
}

export async function GET(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!await verifySystem(id, user.company_id, Boolean(user.is_admin))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const items = await listOperationsBudgetItems(id);
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  if (!await verifySystem(id, user.company_id, Boolean(user.is_admin))) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const parsed = createOpsBudgetItemSchema.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'name required' }, { status: 400 });
  const { category, name, planned_amount, actual_amount, unit, period_label, notes } = parsed.data;

  const created = await createOperationsBudgetItem(id, {
    category, name, planned_amount, actual_amount, unit, period_label, notes,
  });
  return NextResponse.json(created, { status: 201 });
}
