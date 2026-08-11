import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { createRisk, deleteRisk, listRisks, updateRisk } from '@/lib/services/risks.service';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listRisks(params.id, actor)),
);

export const POST = withProjectAccess(async (_req, { params, actor, body }) =>
  NextResponse.json(await createRisk(params.id, actor, body as Record<string, unknown>), { status: 201 }),
);

export const PUT = withProjectAccess(async (_req, { params, actor, body }) => {
  const { id: rowId, ...fields } = body as Record<string, unknown>;
  return NextResponse.json(await updateRisk(params.id, actor, rowId as string | number, fields));
});

export const DELETE = withProjectAccess(async (req, { params, actor }) => {
  const rowId = new URL(req.url).searchParams.get('rowId') ?? '';
  await deleteRisk(params.id, actor, rowId);
  return NextResponse.json({ ok: true });
});
