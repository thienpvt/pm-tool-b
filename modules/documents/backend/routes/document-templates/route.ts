import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { withCpmo } from '@/lib/http/with-role';
import {
  createTemplateVersion,
  listEffectiveTemplates,
} from '@/modules/documents/backend/services/document-templates.service';

const createTemplateSchema = z
  .object({
    catalog_id: z.number().int().positive(),
    name: z.string().min(1),
    document_type: z.string().min(1),
    effective_date: z.string(),
    guidance: z.string().optional(),
    template_url: z.string().min(1),
  })
  .strict();

export const GET = withAuth(async (req, { actor }) => {
  const catalogIdParam = req.nextUrl.searchParams.get('catalog_id');
  const catalogId =
    catalogIdParam !== null && catalogIdParam !== ''
      ? Number(catalogIdParam)
      : undefined;
  return NextResponse.json(
    await listEffectiveTemplates(
      actor,
      catalogId !== undefined && !Number.isNaN(catalogId) ? catalogId : undefined,
    ),
  );
});

export const POST = withCpmo(
  async (_req, { actor, body }) => {
    const row = await createTemplateVersion(actor, body as Record<string, unknown>);
    return NextResponse.json(row, { status: 201 });
  },
  { schema: createTemplateSchema },
);
