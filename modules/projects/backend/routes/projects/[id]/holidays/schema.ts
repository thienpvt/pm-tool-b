import { z } from 'zod';

// Both fields stay optional — holidays.service.ts's createHoliday throws
// ValidationError('date required') when missing; Zod must not pre-empt that
// with a stricter 400 (Pitfall 3).
export const holidayInputSchema = z.object({
  date: z.string().optional(),
  name: z.string().optional(),
}).passthrough();
