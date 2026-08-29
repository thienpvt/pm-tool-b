import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  getActivitiesImportHandler,
  postActivitiesImportHandler,
} from './handlers';

export const GET = withProjectAccess(getActivitiesImportHandler);

export const POST = withProjectAccess(postActivitiesImportHandler);
