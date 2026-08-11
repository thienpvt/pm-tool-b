import { z } from 'zod';

// Frozen 400 body: { error: 'id required' } — DELETE reads `id` from a query
// param (no body), so only PUT gets a schema.
export const updateDemoRequestSchema = z.object({
  id: z.union([z.number(), z.string()]),
  status: z.string().optional(),
  notes: z.string().optional(),
});
