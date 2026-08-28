import { z } from 'zod';
import { dashboardFiltersSchema } from '@/lib/dashboards/filter-schema';

export const portfolioExportSchema = z.object({
  format: z.enum(['xlsx', 'pdf']),
  filters: dashboardFiltersSchema.optional(),
});
