import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
import { documentInputSchema, documentUpdateSchema } from './schema';

export async function getDocumentsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await listDocuments(params.id, actor)); }

export async function postDocumentsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
    const result = await upsertDocument(params.id, actor, body as Record<string, unknown>);
    return NextResponse.json(result.row, { status: result.created ? 201 : 200 });
  },
  { schema: documentInputSchema },

export async function putDocumentsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
    const b = body as { id: string | number; title: string; content: string };
    return NextResponse.json(await updateDocument(params.id, actor, b.id, b.title, b.content));
  },
  { schema: documentUpdateSchema },

export async function deleteDocumentsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const docId = new URL(req.url).searchParams.get('docId');
  return NextResponse.json(await deleteDocument(params.id, actor, docId));
}
