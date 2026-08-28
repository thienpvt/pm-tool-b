import { z } from 'zod';

// Shape guard only — milestones.service.ts's createMilestone/updateMilestone
// accept any object shape today (no inline validation).
export const milestoneInputSchema = z.object({}).passthrough();
export const milestoneUpdateSchema = z.object({}).passthrough();
