import { withProjectAccess } from '@/lib/http/with-project-access';
import { deleteBudgetItemIdExpensesExpIdHandler } from '@/modules/projects/backend/routes/projects/[id]/budget/[itemId]/expenses/[expId]/handlers';

export const DELETE = withProjectAccess(deleteBudgetItemIdExpensesExpIdHandler);
