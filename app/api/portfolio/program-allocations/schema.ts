import { z } from 'zod';

// Shape guard only — createProgramAllocation (portfolio.service.ts) already
// throws ValidationError('program_id required') at the service layer. This
// schema must not duplicate that message at the Zod layer; it only rejects
// non-object bodies, letting the service produce the frozen 400.
export const programAllocationSchema = z.object({
  program_id: z.unknown().optional(),
  allocated_headcount: z.unknown().optional(),
}).passthrough();
