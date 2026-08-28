import { withProjectAccess } from '@/lib/http/with-project-access';
import { postActivitiesImportHandler, getActivitiesImportHandler } from '@/modules/projects/backend/routes/projects/[id]/activities/import/handlers';

export const POST = withProjectAccess(postActivitiesImportHandler);

export const GET = withProjectAccess(getActivitiesImportHandler);
