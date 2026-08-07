import { NextRequest, NextResponse } from 'next/server';
import { repoErrorResponse } from '@/lib/api-errors';
import { linkEpic, listEpics, unlinkEpic } from '@/lib/repositories/milestones.repo';

type Params = { params: Promise<{ id: string; milestoneId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { milestoneId } = await params;
  try {
    return NextResponse.json(await listEpics(milestoneId));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { milestoneId } = await params;
  try {
    const body = await req.json();
    await linkEpic(milestoneId, body.activity_id);
  } catch {
    // already linked — ignore, matching the previous handler
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { milestoneId } = await params;
  const activityId = new URL(req.url).searchParams.get('activity_id');
  try {
    await unlinkEpic(milestoneId, activityId ?? '');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
