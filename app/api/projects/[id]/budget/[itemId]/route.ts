import { withProjectAccess } from '@/lib/http/with-project-access';
import { putBudgetItemIdHandler, deleteBudgetItemIdHandler } from '@/modules/projects/backend/routes/projects/[id]/budget/[itemId]/handlers';
import { budgetItemUpdateSchema } from '@/modules/projects/backend/routes/projects/[id]/budget/[itemId]/schema';

export const PUT = withProjectAccess(putBudgetItemIdHandler, { schema: budgetItemUpdateSchema });

export const DELETE = withProjectAccess(deleteBudgetItemIdHandler);
