import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  getWeeklyReportHandler,
  patchWeeklyReportHandler,
} from '@/modules/weekly/backend/routes/projects/[id]/weekly-reports/[reportId]/handlers';
import { weeklyReportDraftSchema } from '@/modules/weekly/backend/routes/projects/[id]/weekly-reports/[reportId]/schema';

export const GET = withProjectAccess(getWeeklyReportHandler);

export const PATCH = withProjectAccess(
  patchWeeklyReportHandler,
  { schema: weeklyReportDraftSchema },
);
