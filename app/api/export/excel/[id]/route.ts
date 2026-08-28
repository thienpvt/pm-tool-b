import { withProjectAccess } from '@/lib/http/with-project-access';
import { getExportExcelHandler } from '@/modules/reports/backend/routes/export/excel/[id]/handlers';

// generateProjectPlan(id, actor) self-asserts project access (Phase 4 SVC-06);
// withProjectAccess adds a second, redundant-but-idempotent assert. Kept for
// the uniform wrapper model — documented in 06-04-SUMMARY.md.
export const GET = withProjectAccess(getExportExcelHandler);
