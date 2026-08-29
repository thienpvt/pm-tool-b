import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  getBudgetItemIdExpensesHandler,
  postBudgetItemIdExpensesHandler,
} from './handlers';
import { expenseInputSchema } from './schema';

export const GET = withProjectAccess(getBudgetItemIdExpensesHandler);

export const POST = withProjectAccess(postBudgetItemIdExpensesHandler, { schema: expenseInputSchema });
