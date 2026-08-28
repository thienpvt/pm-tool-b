import { withProjectAccess } from '@/lib/http/with-project-access';
import { getProjectWeeklyReportsHandler } from '@/modules/weekly/backend/routes/projects/[id]/weekly-reports/handlers';

export const GET = withProjectAccess(getProjectWeeklyReportsHandler);
