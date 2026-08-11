import { z } from 'zod';

// Same loose shape guard as budget/schema.ts — budget-items.service.ts's
// updateBudgetItem already throws ValidationError('Name is required') /
// ValidationError('Invalid type') at the service layer; no Zod-level
// `.min(1)`/`.enum()` duplicate (Pitfall 3, budget.service.ts:56 type-value rule).
export const budgetItemUpdateSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  group_name: z.string().optional(),
  planned_amount: z.union([z.string(), z.number()]).optional(),
  approved_amount: z.union([z.string(), z.number()]).optional(),
  actual_amount: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();
