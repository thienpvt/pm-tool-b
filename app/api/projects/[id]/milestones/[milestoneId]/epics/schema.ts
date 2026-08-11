import { z } from 'zod';

// epics POST matches body.activity_id usage in milestones.service.ts's linkEpic.
export const epicInputSchema = z.object({
  activity_id: z.union([z.string(), z.number()]),
}).passthrough();
