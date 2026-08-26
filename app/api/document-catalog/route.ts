import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/http/with-auth';
import { withCpmo } from '@/lib/http/with-role';
import {
  createDocumentCatalogItem,
  listDocumentCatalog,
} from '@/lib/services/document-catalog.service';

const createCatalogSchema = z
  .object({
    name: z.string().min(1),
    purpose: z.string().optional(),
    stage: z.enum(['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'ALL']),
    mandatory: z.boolean().optional(),
    active: z.boolean().optional(),
    apply_to_in_flight: z.boolean().optional(),
  })
  .strict();

export const GET = withAuth(async (_req, { actor }) =>
  NextResponse.json(await listDocumentCatalog(actor)),
);

export const POST = withCpmo(
  async (_req, { actor, body }) => {
    const row = await createDocumentCatalogItem(actor, body as Record<string, unknown>);
    return NextResponse.json(row, { status: 201 });
  },
  { schema: createCatalogSchema },
);
