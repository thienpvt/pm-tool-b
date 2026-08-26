import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { withCpmo } from '@/lib/http/with-role';
import {
  getDocumentCatalogItem,
  updateDocumentCatalogItem,
} from '@/lib/services/document-catalog.service';

const updateCatalogSchema = z
  .object({
    name: z.string().min(1).optional(),
    purpose: z.string().optional(),
    stage: z.enum(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'ALL']).optional(),
    mandatory: z.boolean().optional(),
    active: z.boolean().optional(),
    apply_to_in_flight: z.boolean().optional(),
  })
  .strict();

export const GET = withAuth<{ id: string }>(async (_req, { actor, params }) =>
  NextResponse.json(await getDocumentCatalogItem(actor, params.id)),
);

export const PATCH = withCpmo<{ id: string }>(
  async (_req, { actor, params, body }) => {
    const row = await updateDocumentCatalogItem(
      actor,
      params.id,
      body as Record<string, unknown>,
    );
    return NextResponse.json(row);
  },
  { schema: updateCatalogSchema },
);
