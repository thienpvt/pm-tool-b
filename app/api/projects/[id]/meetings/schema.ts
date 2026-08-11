import { z } from 'zod';

// Shape guard only — meetings.service.ts accepts any object shape today (no
// inline validation). See Pitfall 3 (05-RESEARCH.md).
export const meetingInputSchema = z.object({}).passthrough();
export const meetingUpdateSchema = z.object({}).passthrough();
