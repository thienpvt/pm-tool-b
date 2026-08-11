import { z } from 'zod';

// Shape guard only — risks.service.ts accepts any object shape today (no inline
// validation, no per-field ValidationError). A strict schema here would reject
// bodies that pass unchanged through the service. See Pitfall 3 (05-RESEARCH.md).
export const riskInputSchema = z.object({}).passthrough();
export const riskUpdateSchema = z.object({}).passthrough();
