import { z } from 'zod';

// bugs.service.ts's replaceSnapshot already throws ValidationError('bugs must be
// array') for a non-array `bugs` — this schema only shape-guards so a non-object
// body 400s at the boundary instead of reaching the service; it does NOT
// duplicate the array-membership check (Pitfall 3).
export const bugsInputSchema = z.object({
  bugs: z.array(z.record(z.string(), z.unknown())).optional(),
  snapshot_date: z.string().optional(),
}).passthrough();
