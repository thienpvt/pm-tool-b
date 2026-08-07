import { NextRequest, NextResponse } from 'next/server';
import { repoErrorResponse } from '@/lib/api-errors';
import {
  createDocument,
  deleteDocument,
  findDocumentByType,
  findDocumentInProject,
  getDocument,
  listDocuments,
  updateDocumentContent,
} from '@/lib/repositories/documents.repo';

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    return NextResponse.json(await listDocuments(id));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();

    // Weekly reports always create a new row (diary style — no upsert)
    if (body.type === 'status_report') {
      const created = await createDocument(id, 'status_report', body.title ?? 'Weekly Report', JSON.stringify(body.content ?? {}));
      return NextResponse.json(created, { status: 201 });
    }

    // All other types: upsert (one per type per project)
    const existing = await findDocumentByType(id, body.type);
    if (existing) {
      const updated = await updateDocumentContent(existing.id, body.title ?? body.type, JSON.stringify(body.content));
      return NextResponse.json(updated);
    }
    const created = await createDocument(id, body.type, body.title ?? body.type, JSON.stringify(body.content ?? {}));
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const body = await req.json();
    const doc = await findDocumentInProject(id, body.id);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await updateDocumentContent(body.id, body.title, JSON.stringify(body.content));
    return NextResponse.json(await getDocument(body.id));
  } catch (e) {
    return repoErrorResponse(e);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const docId = new URL(req.url).searchParams.get('docId');
  if (!docId) return NextResponse.json({ error: 'Missing docId' }, { status: 400 });
  try {
    const doc = await findDocumentInProject(id, docId);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    await deleteDocument(docId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return repoErrorResponse(e);
  }
}
