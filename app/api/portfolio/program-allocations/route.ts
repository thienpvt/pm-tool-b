import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import {
  programFteAllocations,
  upsertPortfolioProgramAllocation,
} from '@/lib/repositories/portfolio.repo';

// GET: ALL programs for this company with their allocation + actual FTE
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.company_id) return NextResponse.json([]);

  const rows = await programFteAllocations(user.company_id);
  return NextResponse.json(rows);
}

// POST: upsert — UPDATE first, INSERT if no rows matched
export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { program_id, allocated_headcount } = await req.json();
  if (!program_id) return NextResponse.json({ error: 'program_id required' }, { status: 400 });
  const headcount = Math.max(0, Number(allocated_headcount) || 0);
  const pid = Number(program_id);
  try {
    await upsertPortfolioProgramAllocation(user.company_id, pid, headcount);
    return NextResponse.json({ program_id: pid, allocated_headcount: headcount });
  } catch (e) {
    console.error('program-allocations POST error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
