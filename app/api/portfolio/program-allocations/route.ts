import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { createProgramAllocation, listProgramAllocations } from '@/lib/services/portfolio.service';
import { programAllocationSchema } from './schema';

// GET: ALL programs for this company with their allocation + actual FTE.
// Company-scoped (no [id] param) — plain withAuth, not withProgramAccess.
export const GET = withAuth(async (_req, { actor }) =>
  NextResponse.json(await listProgramAllocations(actor)),
);

// POST: upsert — UPDATE first, INSERT if no rows matched.
// Shape guard only — createProgramAllocation's own ValidationError produces
// the frozen 400, not this schema (see schema.ts).
export const POST = withAuth(
  async (_req, { actor, body }) =>
    NextResponse.json(await createProgramAllocation(actor, body as Record<string, unknown>)),
  { schema: programAllocationSchema },
);
