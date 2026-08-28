import { NextResponse } from 'next/server';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  createProjectBenefit,
  listProjectBenefits,
  patchProjectBenefit,
} from '@/lib/services/benefits.service';
import { benefitCreateSchema, benefitPatchSchema } from './schema';

export const GET = withProjectAccess(async (_req, { params, actor }) =>
  NextResponse.json(await listProjectBenefits(params.id, actor)),
);

export const POST = withProjectAccess(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await createProjectBenefit(params.id, actor, body as Record<string, unknown>),
      { status: 201 },
    ),
  { schema: benefitCreateSchema },
);

export const PATCH = withProjectAccess(
  async (_req, { params, actor, body }) => {
    const payload = body as Record<string, unknown>;
    const benefitId = payload.id;
    if (benefitId === undefined || benefitId === null || benefitId === '') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    return NextResponse.json(
      await patchProjectBenefit(params.id, actor, benefitId, payload),
    );
  },
  { schema: benefitPatchSchema },
);
