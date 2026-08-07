import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse } from '@/lib/api-errors';
import { createExpense, getBudgetItemInProject, listExpensesByItem } from '@/lib/repositories/budget.repo';
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

export async function GET(req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  if (!await authorize(req, id)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await listExpensesByItem(id, itemId));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id, itemId } = await params;
  if (!await authorize(req, id)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    if (!body.description?.trim()) return NextResponse.json({ error: 'Description is required' }, { status: 400 });
    const item = await getBudgetItemInProject(id, itemId);
    if (!item) return NextResponse.json({ error: 'Budget item not found' }, { status: 404 });
    return NextResponse.json(await createExpense(id, itemId, body), { status: 201 });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
