import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import { createProgramAllocation, listProgramAllocations } from '@/lib/services/portfolio.service';
import { programAllocationSchema } from './schema';

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

// GET: ALL programs for this company with their allocation + actual FTE
export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await listProgramAllocations(actorOf(user));
  return NextResponse.json(rows);
}

// POST: upsert — UPDATE first, INSERT if no rows matched
export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const raw = await req.json();
  // Shape guard only — createProgramAllocation's own ValidationError produces
  // the frozen 400, not this schema (see schema.ts).
  const parsed = programAllocationSchema.safeParse(raw);
  const body = parsed.success ? parsed.data : raw;
  try {
    const result = await createProgramAllocation(actorOf(user), body);
    return NextResponse.json(result);
  } catch (e) {
    // HYG-02: was `{ error: String(e) }` — a server error now surfaces as the
    // generic serviceErrorResponse 500, never the raw error text.
    return serviceErrorResponse(e);
  }
}
