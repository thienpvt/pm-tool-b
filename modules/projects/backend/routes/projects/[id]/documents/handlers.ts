import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
  deleteDocument,
  listDocuments,
  updateDocument,
  upsertDocument,
} from '@/modules/projects/backend/services/documents.service';

export async function getDocumentsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(await listDocuments(params.id, actor));
}

export async function postDocumentsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  const result = await upsertDocument(params.id, actor, body as Record<string, unknown>);
  return NextResponse.json(result.row, { status: result.created ? 201 : 200 });
}

export async function putDocumentsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  const b = body as { id: string | number; title: string; content: string };
  return NextResponse.json(await updateDocument(params.id, actor, b.id, b.title, b.content));
}

export async function deleteDocumentsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const docId = new URL(_req.url).searchParams.get('docId');
  return NextResponse.json(await deleteDocument(params.id, actor, docId));
}
