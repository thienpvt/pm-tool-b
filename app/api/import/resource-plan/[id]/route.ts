import { withProjectAccess } from '@/lib/http/with-project-access';
import { postImportResourcePlanHandler } from '@/modules/jira/backend/routes/import/resource-plan/[id]/handlers';

export const POST = withProjectAccess(postImportResourcePlanHandler, { rawBody: true });
