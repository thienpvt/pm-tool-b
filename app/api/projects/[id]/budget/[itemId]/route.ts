import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse } from '@/lib/api-errors';
import { deleteBudgetItem, updateBudgetItem } from '@/lib/repositories/budget.repo';
import { projectAccessRow } from '@/lib/repositories/projects.repo';

type Ctx = { params: Promise<{ id: string; itemId: string }> };

async function authorize(req: NextRequest, projectId: string) {
  const user = await getSessionFromRequest(req);
  if (!user) return null;
  if (user.is_admin) return user;
  const project = await projectAccessRow(projectId);
  if (!project) return null;
  if (project.company_id !== user.company_id && project.customer_company_id !== user.company_id) return null;
  return user;
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  if (!await authorize(req, id)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!['CAPEX', 'OPEX'].includes(body.type)) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    const updated = await updateBudgetItem(id, itemId, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  if (!await authorize(req, id)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await deleteBudgetItem(id, itemId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
