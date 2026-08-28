import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
  deleteProgram,
  getProgramDetail,
  updateProgram,
} from '@/modules/portfolio/backend/services/programs.service';

export async function getProgramHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(await getProgramDetail(params.id, actor));
}

export async function putProgramHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(await updateProgram(params.id, actor, body as Record<string, unknown>));
}

export async function deleteProgramHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(await deleteProgram(params.id, actor));
}
