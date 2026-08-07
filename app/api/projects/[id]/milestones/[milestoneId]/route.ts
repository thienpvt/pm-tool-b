import { NextRequest, NextResponse } from 'next/server';
import { repoErrorResponse } from '@/lib/api-errors';
import { deleteMilestone, updateMilestone } from '@/lib/repositories/milestones.repo';

type Params = { params: Promise<{ id: string; milestoneId: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  const { id, milestoneId } = await params;
  try {
    const body = await req.json();
    return NextResponse.json(await updateMilestone(id, milestoneId, body));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id, milestoneId } = await params;
  try {
    await deleteMilestone(id, milestoneId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
