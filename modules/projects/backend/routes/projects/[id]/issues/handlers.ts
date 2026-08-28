import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { createIssue, deactivateIssue, listIssues, updateIssue } from '@/modules/projects/backend/services/issues.service';
import { issueInputSchema, issueUpdateSchema } from './schema';

export async function getIssuesHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await listIssues(params.id, actor)); }

export async function postIssuesHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await createIssue(params.id, actor, body as Record<string, unknown>), { status: 201 }); }

export async function putIssuesHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
    const { id: rowId, ...fields } = body as Record<string, unknown>;
    return NextResponse.json(await updateIssue(params.id, actor, rowId as string | number, fields));
  },
  { schema: issueUpdateSchema },

export async function deleteIssuesHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const rowId = new URL(req.url).searchParams.get('rowId') ?? '';
  await deactivateIssue(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
}
