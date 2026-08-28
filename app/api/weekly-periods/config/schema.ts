import { z } from 'zod';

export const weeklyConfigSchema = z.object({
  due_weekday: z.number().int().min(0).max(6),
  due_time_utc: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, 'due_time_utc must be HH:MM or HH:MM:SS'),
});
