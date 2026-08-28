import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  getWeeklyReportHandler,
  postWeeklyReportHandler,
} from '@/modules/reports/backend/routes/projects/[id]/report/handlers';

export const GET = withProjectAccess(getWeeklyReportHandler);

export const POST = withProjectAccess(postWeeklyReportHandler, { rawBody: true });
