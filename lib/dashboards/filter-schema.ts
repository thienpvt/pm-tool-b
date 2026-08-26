import { z } from 'zod';

export const dashboardFiltersSchema = z
  .object({
    portfolio_year: z.number().optional(),
    program: z.number().optional(),
    unit: z.string().optional(),
    pm_user_id: z.number().optional(),
    stage: z.string().optional(),
    status: z.string().optional(),
    rag: z.string().optional(),
    type: z.string().optional(),
    weekly_report_enabled: z.boolean().optional(),
  })
  .strict();

export const filterActionSchema = z.object({
  action: z.enum(['clear', 'defaults']),
});
