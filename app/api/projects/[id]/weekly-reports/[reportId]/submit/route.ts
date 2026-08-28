import { withProjectAccess } from '@/lib/http/with-project-access';
import { submitWeeklyReportHandler } from '@/modules/weekly/backend/routes/projects/[id]/weekly-reports/[reportId]/submit/handlers';

export const POST = withProjectAccess(
  submitWeeklyReportHandler,
  { rawBody: true },
);
