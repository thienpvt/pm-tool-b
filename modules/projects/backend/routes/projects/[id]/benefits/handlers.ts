import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { HandlerContext } from '@/lib/http/with-auth';
import {
  createProjectBenefit,
  listProjectBenefits,
  patchProjectBenefit,
} from '@/modules/projects/backend/services/benefits.service';

export async function getBenefitsHandler(
  _req: NextRequest,
  { params, actor }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(await listProjectBenefits(params.id, actor));
}

export async function postBenefitsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  return NextResponse.json(
    await createProjectBenefit(params.id, actor, body as Record<string, unknown>),
    { status: 201 },
  );
}

export async function patchBenefitsHandler(
  _req: NextRequest,
  { params, actor, body }: HandlerContext<{ id: string }>,
) {
  const payload = body as Record<string, unknown>;
  const benefitId = payload.id;
  if (benefitId === undefined || benefitId === null || benefitId === '') {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }
  return NextResponse.json(
    await patchProjectBenefit(params.id, actor, benefitId, payload),
  );
}
