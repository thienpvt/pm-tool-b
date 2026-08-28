import { withProjectAccess } from '@/lib/http/with-project-access';
import { getEscalationsHandler, putEscalationsHandler } from '@/modules/projects/backend/routes/projects/[id]/escalations/handlers';
import { escalationUpdateSchema } from '@/modules/projects/backend/routes/projects/[id]/escalations/schema';

export const GET = withProjectAccess(getEscalationsHandler);

export const PUT = withProjectAccess(putEscalationsHandler, { schema: escalationUpdateSchema });
