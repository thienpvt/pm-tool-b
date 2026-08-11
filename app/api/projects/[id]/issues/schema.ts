import { z } from 'zod';

// Shape guard only — issues.service.ts accepts any object shape today (no
// inline validation). See Pitfall 3 (05-RESEARCH.md).
export const issueInputSchema = z.object({}).passthrough();
export const issueUpdateSchema = z.object({}).passthrough();
