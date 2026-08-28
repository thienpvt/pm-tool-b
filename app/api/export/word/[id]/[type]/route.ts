import { withProjectAccess } from '@/lib/http/with-project-access';
import { getExportWordHandler } from '@/modules/reports/backend/routes/export/word/[id]/[type]/handlers';

// generateWordDoc(id, actor, type, docId) self-asserts project access (Phase 4
// SVC-06); withProjectAccess adds a second, redundant-but-idempotent assert.
export const GET = withProjectAccess(getExportWordHandler);
