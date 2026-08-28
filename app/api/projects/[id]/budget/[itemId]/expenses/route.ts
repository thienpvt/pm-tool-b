import { withProjectAccess } from '@/lib/http/with-project-access';
import { getBudgetItemIdExpensesHandler, postBudgetItemIdExpensesHandler } from '@/modules/projects/backend/routes/projects/[id]/budget/[itemId]/expenses/handlers';
import { expenseInputSchema } from '@/modules/projects/backend/routes/projects/[id]/budget/[itemId]/expenses/schema';

export const GET = withProjectAccess(getBudgetItemIdExpensesHandler);

export const POST = withProjectAccess(postBudgetItemIdExpensesHandler, { schema: expenseInputSchema });
