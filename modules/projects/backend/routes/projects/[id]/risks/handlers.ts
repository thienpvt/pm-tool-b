import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { createRisk, deactivateRisk, listRisks, updateRisk } from '@/modules/projects/backend/services/risks.service';
import { riskInputSchema, riskUpdateSchema } from './schema';

export async function getRisksHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await listRisks(params.id, actor)); }

export async function postRisksHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await createRisk(params.id, actor, body as Record<string, unknown>), { status: 201 }); }

export async function putRisksHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
    const { id: rowId, ...fields } = body as Record<string, unknown>;
    return NextResponse.json(await updateRisk(params.id, actor, rowId as string | number, fields));
  },
  { schema: riskUpdateSchema },

export async function deleteRisksHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  const rowId = new URL(req.url).searchParams.get('rowId') ?? '';
  await deactivateRisk(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
}
