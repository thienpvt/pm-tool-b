import { z } from 'zod';

export const checklistPatchSchema = z
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
