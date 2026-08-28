import { withProjectAccess } from '@/lib/http/with-project-access';
import { getActivitiesHandler, postActivitiesHandler, putActivitiesHandler, deleteActivitiesHandler } from '@/modules/projects/backend/routes/projects/[id]/activities/handlers';
import { activityInputSchema, activityUpdateSchema } from '@/modules/projects/backend/routes/projects/[id]/activities/schema';

export const GET = withProjectAccess(getActivitiesHandler);

export const POST = withProjectAccess(postActivitiesHandler, { schema: activityInputSchema });

export const PUT = withProjectAccess(putActivitiesHandler, { schema: activityUpdateSchema });

export const DELETE = withProjectAccess(deleteActivitiesHandler);
