import { NextRequest, NextResponse } from 'next/server';
import { repoErrorResponse } from '@/lib/api-errors';
import { listEscalations, updateEscalation } from '@/lib/repositories/escalations.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    return NextResponse.json(await listEscalations(id));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { id: rowId, ...fields } = body;
    const updated = await updateEscalation(id, rowId, fields);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    return repoErrorResponse(e);
  }
}
