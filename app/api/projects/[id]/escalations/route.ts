import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import { listEscalations, updateEscalation } from '@/lib/services/escalations.service';
import { escalationUpdateSchema } from './schema';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listEscalations(params.id, actor)),
);

export const PUT = withProjectAccess(
  async (_req, { params, actor, body }) => {
    const { id: rowId, ...fields } = body as Record<string, unknown>;
    return NextResponse.json(await updateEscalation(params.id, actor, rowId as string | number, fields));
  },
  { schema: escalationUpdateSchema },
);
