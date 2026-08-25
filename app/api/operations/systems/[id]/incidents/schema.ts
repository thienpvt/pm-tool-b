import { z } from 'zod';

// Frozen 400 body: { error: 'title required' }
export const createOpsIncidentSchema = z.object({
  title: z.string().min(1),
  severity: z.string().optional(),
  description: z.string().optional(),
  reported_at: z.string().nullable().optional(),
  resolved_at: z.string().nullable().optional(),
  cost_impact: z.union([z.number(), z.string()]).nullable().optional(),
  status: z.string().optional(),
});
