import { z } from 'zod';

// Frozen 400 body: { error: 'name required' }
export const createOpsBudgetItemSchema = z.object({
  category: z.string().optional(),
  name: z.string().min(1),
  planned_amount: z.union([z.number(), z.string()]).nullable().optional(),
  actual_amount: z.union([z.number(), z.string()]).nullable().optional(),
  unit: z.string().optional(),
  period_label: z.string().optional(),
  notes: z.string().optional(),
});
