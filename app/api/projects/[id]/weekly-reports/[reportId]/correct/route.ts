import { withProjectAccess } from '@/lib/http/with-project-access';
import { correctWeeklyReportHandler } from '@/modules/weekly/backend/routes/projects/[id]/weekly-reports/[reportId]/correct/handlers';
import { weeklyReportCorrectionSchema } from '@/modules/weekly/backend/routes/projects/[id]/weekly-reports/[reportId]/schema';

export const POST = withProjectAccess(
  correctWeeklyReportHandler,
  { schema: weeklyReportCorrectionSchema },
);
