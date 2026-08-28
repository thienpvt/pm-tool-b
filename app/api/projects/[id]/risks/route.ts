import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { createRisk, deactivateRisk, listRisks, updateRisk } from '@/modules/projects/backend/services/risks.service';
import { riskInputSchema, riskUpdateSchema } from './schema';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listRisks(params.id, actor)),
);

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(await createRisk(params.id, actor, body as Record<string, unknown>), { status: 201 }),
  { schema: riskInputSchema },
);

export const PUT = withProjectAccess(
  async (_req, { params, actor, body }) => {
    const { id: rowId, ...fields } = body as Record<string, unknown>;
    return NextResponse.json(await updateRisk(params.id, actor, rowId as string | number, fields));
  },
  { schema: riskUpdateSchema },
);

export const DELETE = withProjectAccess(async (req, { params, actor }) => {
  const rowId = new URL(req.url).searchParams.get('rowId') ?? '';
  await deactivateRisk(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
});
