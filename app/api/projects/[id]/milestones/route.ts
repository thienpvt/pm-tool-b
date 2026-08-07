import { NextRequest, NextResponse } from 'next/server';
import { repoErrorResponse } from '@/lib/api-errors';
import { createMilestone, listMilestones } from '@/lib/repositories/milestones.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    return NextResponse.json(await listMilestones(id));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    return NextResponse.json(await createMilestone(id, body), { status: 201 });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
