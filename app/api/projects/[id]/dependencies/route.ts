import { withProjectAccess } from '@/lib/http/with-project-access';
import { getDependenciesHandler, postDependenciesHandler, patchDependenciesHandler } from '@/modules/projects/backend/routes/projects/[id]/dependencies/handlers';
import { dependencyCreateSchema, dependencyEndSchema } from '@/modules/projects/backend/routes/projects/[id]/dependencies/schema';

export const GET = withProjectAccess(getDependenciesHandler);

export const POST = withProjectAccess(postDependenciesHandler, { schema: dependencyCreateSchema });

export const PATCH = withProjectAccess(patchDependenciesHandler, { schema: dependencyEndSchema });
