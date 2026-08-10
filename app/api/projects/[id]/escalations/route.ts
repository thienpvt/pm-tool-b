import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { repoErrorResponse, serviceErrorResponse } from '@/lib/api-errors';
import { UnknownColumnError } from '@/lib/repositories/_helpers';
import { listEscalations, updateEscalation } from '@/lib/services/escalations.service';

type Params = { params: Promise<{ id: string }> };

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

function mapError(e: unknown) {
  if (e instanceof UnknownColumnError) return repoErrorResponse(e);
  return serviceErrorResponse(e);
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await listEscalations(id, actorOf(user)));
  } catch (e) {
    return mapError(e);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { id: rowId, ...fields } = body;
    return NextResponse.json(await updateEscalation(id, actorOf(user), rowId, fields));
  } catch (e) {
    return mapError(e);
  }
}
