import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  getChecklistItem,
  patchChecklistItem,
} from '@/modules/documents/backend/services/project-document-checklist.service';

const checklistPatchSchema = z
  .object({
    status: z
      .enum(['none', 'drafting', 'pending_approval', 'approved', 'not_applicable'])
      .optional(),
    confluence_url: z.string().nullable().optional(),
    approved_at: z.string().optional(),
    approved_by: z.union([z.number(), z.string()]).optional(),
    na_reason: z.string().optional(),
    notes: z.string().nullable().optional(),
  })
  .strict();

export const GET = withProjectAccess<{ id: string; itemId: string }>(
  async (_req, { params, actor }) =>
    NextResponse.json(await getChecklistItem(params.id, params.itemId, actor)),
);

export const PATCH = withProjectAccess<{ id: string; itemId: string }>(
  async (_req, { params, actor, body }) =>
    NextResponse.json(
      await patchChecklistItem(
        params.id,
        params.itemId,
        actor,
        body as Record<string, unknown>,
      ),
    ),
  { schema: checklistPatchSchema },
);
