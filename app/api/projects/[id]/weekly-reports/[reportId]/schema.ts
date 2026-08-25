import { z } from 'zod';

const ragEnum = z.enum(['Green', 'Amber', 'Red', 'Not applicable']);

export const weeklyReportDraftSchema = z
  .object({
    highlights: z.string().nullable().optional(),
    completed_work: z.string().nullable().optional(),
    next_week_goals: z.string().nullable().optional(),
    nearest_milestone: z.string().nullable().optional(),
    nearest_milestone_id: z.number().nullable().optional(),
    raid_dependency: z.string().nullable().optional(),
    leadership_support: z.string().nullable().optional(),
    this_week_rag: ragEnum.optional(),
    draft_raid_json: z.unknown().optional(),
  })
  .strict();

export const weeklyReportCorrectionSchema = weeklyReportDraftSchema.partial();
