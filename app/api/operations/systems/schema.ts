import { z } from 'zod';

// Frozen 400 body: { error: 'name required' }
export const createOperationsSystemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  project_id: z.union([z.number(), z.string()]).nullable().optional(),
  go_live_date: z.string().nullable().optional(),
  status: z.string().optional(),
});
