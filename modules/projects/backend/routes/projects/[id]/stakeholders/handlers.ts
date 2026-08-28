import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
import { stakeholderCreateSchema, stakeholderEndSchema } from './schema';

export async function getStakeholdersHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) { return NextResponse.json(await listProjectStakeholders(params.id, actor)); }

export async function postStakeholdersHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) { return NextResponse.json(
      await createProjectStakeholder(params.id, actor, body as Record<string, unknown>),
      { status: 201 },
    ); }

export async function patchStakeholdersHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
    const payload = body as Record<string, unknown>;
    const stakeholderId = payload.id;
    if (stakeholderId === undefined || stakeholderId === null || stakeholderId === '') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    return NextResponse.json(
      await endProjectStakeholder(params.id, actor, stakeholderId, payload),
    );
  },
  { schema: stakeholderEndSchema },
