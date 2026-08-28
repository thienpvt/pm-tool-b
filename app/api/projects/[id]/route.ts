import { withProjectAccess } from '@/lib/http/with-project-access';
import { z } from 'zod';
import {
  deleteProjectHandler,
  getProjectHandler,
  patchProjectHandler,
} from '@/modules/projects/backend/routes/projects/[id]/handlers';

const projectUpdateSchema = z.object({}).passthrough();

export const GET = withProjectAccess(getProjectHandler);

export const PATCH = withProjectAccess(patchProjectHandler, { schema: projectUpdateSchema });

export const DELETE = withProjectAccess(deleteProjectHandler);
