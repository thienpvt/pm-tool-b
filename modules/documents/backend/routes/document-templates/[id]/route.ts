import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { withCpmo } from '@/lib/http/with-role';
import { getTemplate, retireTemplate } from '@/modules/documents/backend/services/document-templates.service';

const retireSchema = z.object({ retire: z.literal(true) }).strict();

export const GET = withAuth<{ id: string }>(async (_req, { actor, params }) =>
  NextResponse.json(await getTemplate(actor, params.id)),
);

export const PATCH = withCpmo<{ id: string }>(
  async (_req, { actor, params }) =>
    NextResponse.json(await retireTemplate(actor, params.id)),
  { schema: retireSchema },
);
