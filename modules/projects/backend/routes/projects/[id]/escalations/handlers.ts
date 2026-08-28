import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import { listEscalations, updateEscalation } from '@/modules/projects/backend/services/escalations.service';
import { escalationUpdateSchema } from './schema';

export async function getEscalationsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await listEscalations(params.id, actor)); }

export async function putEscalationsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
    const { id: rowId, ...fields } = body as Record<string, unknown>;
    return NextResponse.json(await updateEscalation(params.id, actor, rowId as string | number, fields));
  },
  { schema: escalationUpdateSchema },
