import { z } from 'zod';

// Shape guard only — team.service.ts accepts any object shape today (no
// inline validation). See Pitfall 3 (05-RESEARCH.md).
export const teamInputSchema = z.object({}).passthrough();
export const teamUpdateSchema = z.object({}).passthrough();
