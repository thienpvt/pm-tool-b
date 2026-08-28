import { withProjectAccess } from '@/lib/http/with-project-access';
import { getActivitiesHandler, postActivitiesHandler, putActivitiesHandler, deleteActivitiesHandler } from '@/modules/projects/backend/routes/projects/[id]/activities/handlers';
import { activityInputSchema, activityUpdateSchema } from './schema';

export const GET = withProjectAccess(getActivitiesHandler);

export const POST = withProjectAccess(postActivitiesHandler);

export const PUT = withProjectAccess(putActivitiesHandler);

export const DELETE = withProjectAccess(deleteActivitiesHandler);
