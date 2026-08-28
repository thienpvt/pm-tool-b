import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  getPmAssignmentsHandler,
  patchPmAssignmentsHandler,
  postPmAssignmentsHandler,
} from '@/modules/projects/backend/routes/projects/[id]/pm-assignments/handlers';
import {
  pmAssignmentCreateSchema,
  pmAssignmentEndSchema,
} from '@/modules/projects/backend/routes/projects/[id]/pm-assignments/schema';

export const GET = withProjectAccess(getPmAssignmentsHandler);

export const POST = withProjectAccess(postPmAssignmentsHandler, { schema: pmAssignmentCreateSchema });

export const PATCH = withProjectAccess(patchPmAssignmentsHandler, { schema: pmAssignmentEndSchema });
