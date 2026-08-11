import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  deleteDocument,
  listDocuments,
  updateDocument,
  upsertDocument,
} from '@/lib/services/documents.service';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listDocuments(params.id, actor)),
);

export const POST = withProjectAccess(async (_req, { params, actor, body }) => {
  const result = await upsertDocument(params.id, actor, body as Record<string, unknown>);
  return NextResponse.json(result.row, { status: result.created ? 201 : 200 });
});

export const PUT = withProjectAccess(async (_req, { params, actor, body }) => {
  const b = body as { id: string | number; title: string; content: string };
  return NextResponse.json(await updateDocument(params.id, actor, b.id, b.title, b.content));
});

export const DELETE = withProjectAccess(async (req, { params, actor }) => {
  const docId = new URL(req.url).searchParams.get('docId');
  return NextResponse.json(await deleteDocument(params.id, actor, docId));
});
