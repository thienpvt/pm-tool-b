import { z } from 'zod';

// Frozen 400 body: { error: 'Missing fields' }
export const createJqlPresetSchema = z.object({
  name: z.string().min(1),
  jql: z.string().min(1),
  context: z.string().optional(),
});
