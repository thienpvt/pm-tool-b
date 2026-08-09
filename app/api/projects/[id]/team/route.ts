import { NextRequest, NextResponse } from 'next/server';
import { repoErrorResponse } from '@/lib/api-errors';
import { createTeamMember, deleteTeamMember, listTeam, updateTeamMember } from '@/lib/repositories/team.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    return NextResponse.json(await listTeam(id));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    return NextResponse.json(await createTeamMember(id, body), { status: 201 });
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const { id: rowId, ...fields } = body;
    const updated = await updateTeamMember(id, rowId, fields);
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
    await deleteTeamMember(id, searchParams.get('rowId') ?? '');
    return NextResponse.json({ ok: true });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
