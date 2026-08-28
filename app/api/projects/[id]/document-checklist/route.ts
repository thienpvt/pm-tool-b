import { withProjectAccess } from '@/lib/http/with-project-access';
import { getProjectDocumentChecklistHandler } from '@/modules/documents/backend/routes/projects/[id]/document-checklist/handlers';

export const GET = withProjectAccess(getProjectDocumentChecklistHandler);
