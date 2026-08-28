import { z } from 'zod';

// Shape guard only — activities.service.ts accepts any object shape today (no
// inline validation). See Pitfall 3 (05-RESEARCH.md).
export const activityInputSchema = z.object({}).passthrough();
export const activityUpdateSchema = z.object({}).passthrough();
