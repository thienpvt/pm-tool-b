import { NextRequest, NextResponse } from 'next/server';
import { repoErrorResponse } from '@/lib/api-errors';
import { createIssue, deleteIssue, listIssues, updateIssue } from '@/lib/repositories/issues.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    return NextResponse.json(await listIssues(id));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    return NextResponse.json(await createIssue(id, body), { status: 201 });
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { id: rowId, ...fields } = body;
    const updated = await updateIssue(id, rowId, fields);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(req.url);
  try {
    await deleteIssue(id, searchParams.get('rowId') ?? '');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
