import { z } from 'zod';

// All optional — budget-items.service.ts's createExpense already throws
// ValidationError('Description is required') at the service layer when missing.
export const expenseInputSchema = z.object({
  expense_date: z.string().optional(),
  description: z.string().optional(),
  amount: z.union([z.string(), z.number()]).optional(),
  reference: z.string().optional(),
}).passthrough();
