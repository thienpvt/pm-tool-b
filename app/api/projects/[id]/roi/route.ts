import { withProjectAccess } from '@/lib/http/with-project-access';
import { getRoiHandler } from '@/modules/projects/backend/routes/projects/[id]/roi/handlers';

export const GET = withProjectAccess(getRoiHandler);
