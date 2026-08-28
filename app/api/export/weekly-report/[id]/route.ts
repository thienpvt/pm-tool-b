import { withProjectAccess } from '@/lib/http/with-project-access';
import { exportWeeklyReportHandler } from '@/modules/weekly/backend/routes/export/weekly-report/[id]/handlers';

export const POST = withProjectAccess(exportWeeklyReportHandler);
