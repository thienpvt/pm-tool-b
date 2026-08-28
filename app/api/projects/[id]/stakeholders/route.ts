import { withProjectAccess } from '@/lib/http/with-project-access';
import { getStakeholdersHandler, postStakeholdersHandler, patchStakeholdersHandler } from '@/modules/projects/backend/routes/projects/[id]/stakeholders/handlers';
import { stakeholderCreateSchema, stakeholderEndSchema } from '@/modules/projects/backend/routes/projects/[id]/stakeholders/schema';

export const GET = withProjectAccess(getStakeholdersHandler);

export const POST = withProjectAccess(postStakeholdersHandler, { schema: stakeholderCreateSchema });

export const PATCH = withProjectAccess(patchStakeholdersHandler, { schema: stakeholderEndSchema });
