import { withProjectAccess } from '@/lib/http/with-project-access';
import { postProjectReportGenerateEmailHandler } from '@/modules/reports/backend/routes/projects/[id]/project-report/generate-email/handlers';

export const POST = withProjectAccess(postProjectReportGenerateEmailHandler, { rawBody: true });
