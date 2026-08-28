import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse, serviceErrorResponse } from '@/lib/api-errors';
import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { toAccessActor } from '@/lib/services/access';
import { createProgram, listProgramsWithCounts } from '@/modules/portfolio/backend/services/programs.service';

function mapError(e: unknown) {
  // Rejected column must stay a 400 naming the column, not a generic 500 or 403 (T-04-25).
  if (e instanceof UnknownColumnError) return repoErrorResponse(e);
  return serviceErrorResponse(e);
}

export async function GET(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json([], { status: 401 });

  return NextResponse.json(await listProgramsWithCounts(toAccessActor(user)));
}

export async function POST(req: NextRequest) {
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    return NextResponse.json(await createProgram(toAccessActor(user), body), { status: 201 });
  } catch (e) {
    return mapError(e);
  }
}
