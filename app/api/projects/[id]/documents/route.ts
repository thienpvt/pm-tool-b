import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth';
import { serviceErrorResponse } from '@/lib/api-errors';
import {
  deleteDocument,
  listDocuments,
  updateDocument,
  upsertDocument,
} from '@/lib/services/documents.service';

type Params = { params: Promise<{ id: string }> };

function actorOf(user: { company_id: number | null; is_admin: number }) {
  return { company_id: user.company_id, is_admin: user.is_admin };
}

export async function GET(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    return NextResponse.json(await listDocuments(id, actorOf(user)));
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const result = await upsertDocument(id, actorOf(user), body);
    return NextResponse.json(result.row, { status: result.created ? 201 : 200 });
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    return NextResponse.json(
      await updateDocument(id, actorOf(user), body.id, body.title, body.content),
    );
  } catch (e) {
    return serviceErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const user = await getSessionFromRequest(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const docId = new URL(req.url).searchParams.get('docId');
  try {
    return NextResponse.json(await deleteDocument(id, actorOf(user), docId));
  } catch (e) {
    return serviceErrorResponse(e);
  }
}
