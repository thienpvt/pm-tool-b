import { withProjectAccess } from '@/lib/http/with-project-access';
import { postExportPptHandler } from '@/modules/reports/backend/routes/export/ppt/[id]/handlers';

// generateKickoffPPT(id, actor, body) self-asserts project access (Phase 4
// SVC-06); withProjectAccess adds a second, redundant-but-idempotent assert.
// rawBody: true — the handler parses its own body (preserves the
// req.json().catch(() => ({})) passthrough verbatim).
export const POST = withProjectAccess(postExportPptHandler, { rawBody: true });
