import { withProjectAccess } from '@/lib/http/with-project-access';
import { getBudgetHandler, postBudgetHandler } from './handlers';
import { budgetItemInputSchema } from './schema';

export const GET = withProjectAccess(getBudgetHandler);

export const POST = withProjectAccess(postBudgetHandler, { schema: budgetItemInputSchema });
