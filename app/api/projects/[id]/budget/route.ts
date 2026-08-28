import { withProjectAccess } from '@/lib/http/with-project-access';
import { getBudgetHandler, postBudgetHandler } from '@/modules/projects/backend/routes/projects/[id]/budget/handlers';
import { budgetItemInputSchema } from './schema';

export const GET = withProjectAccess(getBudgetHandler);

export const POST = withProjectAccess(postBudgetHandler);
