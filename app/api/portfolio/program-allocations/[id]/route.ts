import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  deletePortfolioProgramAllocation,
  updatePortfolioProgramAllocation,
} from '@/lib/repositories/portfolio.repo';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { allocated_headcount } = await req.json();
  const headcount = Math.max(0, Number(allocated_headcount) || 0);
  await updatePortfolioProgramAllocation(user.company_id, id, headcount);
  return NextResponse.json({ id: Number(id), allocated_headcount: headcount });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await deletePortfolioProgramAllocation(user.company_id, id);
  return NextResponse.json({ ok: true });
}
