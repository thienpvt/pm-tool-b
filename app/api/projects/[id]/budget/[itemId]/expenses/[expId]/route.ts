import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse } from '@/lib/api-errors';
import { deleteExpense } from '@/lib/repositories/budget.repo';
import { projectAccessRow } from '@/lib/repositories/projects.repo';

type Ctx = { params: Promise<{ id: string; itemId: string; expId: string }> };

async function authorize(req: NextRequest, projectId: string) {
  const user = await getSessionFromRequest(req);
  if (!user) return null;
  if (user.is_admin) return user;
  const project = await projectAccessRow(projectId);
  if (!project) return null;
  if (project.company_id !== user.company_id && project.customer_company_id !== user.company_id) return null;
  return user;
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  const { id, itemId, expId } = await params;
  if (!await authorize(req, id)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    await deleteExpense(id, itemId, expId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
