import { z } from 'zod';

export const createPeriodSchema = z.object({
  iso_week: z.string().regex(/^\d{4}-W\d{2}$/, 'iso_week must be YYYY-Wnn'),
});
