import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  getChecklistItemHandler,
  patchChecklistItemHandler,
} from '@/modules/documents/backend/routes/projects/[id]/document-checklist/[itemId]/handlers';
import { checklistPatchSchema } from '@/modules/documents/backend/routes/projects/[id]/document-checklist/[itemId]/schema';

export const GET = withProjectAccess(getChecklistItemHandler);

export const PATCH = withProjectAccess(patchChecklistItemHandler, { schema: checklistPatchSchema });
