import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  deleteActivitiesHandler,
  getActivitiesHandler,
  postActivitiesHandler,
  putActivitiesHandler,
} from './handlers';
import { activityInputSchema, activityUpdateSchema } from './schema';

export const GET = withProjectAccess(getActivitiesHandler);

export const POST = withProjectAccess(postActivitiesHandler, { schema: activityInputSchema });

export const PUT = withProjectAccess(putActivitiesHandler, { schema: activityUpdateSchema });

export const DELETE = withProjectAccess(deleteActivitiesHandler);
