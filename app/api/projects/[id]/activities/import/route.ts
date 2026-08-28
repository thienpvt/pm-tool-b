import { withProjectAccess } from '@/lib/http/with-project-access';
import { getActivitiesImportHandler, postActivitiesImportHandler } from '@/modules/projects/backend/routes/projects/[id]/activities/import/handlers';

export const GET = withProjectAccess(getActivitiesImportHandler);

export const POST = withProjectAccess(postActivitiesImportHandler);
