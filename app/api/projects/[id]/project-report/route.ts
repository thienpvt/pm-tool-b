import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  getProjectReportHandler,
  postProjectReportHandler,
} from '@/modules/reports/backend/routes/projects/[id]/project-report/handlers';

export const GET = withProjectAccess(getProjectReportHandler);

export const POST = withProjectAccess(postProjectReportHandler, { rawBody: true });
