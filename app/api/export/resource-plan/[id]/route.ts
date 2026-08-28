import { withProjectAccess } from '@/lib/http/with-project-access';
import { getExportResourcePlanHandler } from '@/modules/reports/backend/routes/export/resource-plan/[id]/handlers';

export const GET = withProjectAccess(getExportResourcePlanHandler);
