import { z } from 'zod';

// Loose field typing only — budget.service.ts's createBudgetItem already throws
// ValidationError('Name is required') / ValidationError('Invalid type') for a
// blank name or a bad type value. No `.min(1)` on name and no `.enum()` on
// type here — that would return a DIFFERENT 400 body/message than the service's,
// which is a freeze break (Pitfall 3). Type-value membership stays a service-owned
// business rule, never duplicated as a Zod enum (budget.service.ts:56).
export const budgetItemInputSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  group_name: z.string().optional(),
  planned_amount: z.union([z.string(), z.number()]).optional(),
  approved_amount: z.union([z.string(), z.number()]).optional(),
  actual_amount: z.union([z.string(), z.number()]).optional(),
  unit: z.string().optional(),
  notes: z.string().optional(),
}).passthrough();
