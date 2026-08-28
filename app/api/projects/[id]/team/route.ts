import { withProjectAccess } from '@/lib/http/with-project-access';
import { getTeamHandler, postTeamHandler, putTeamHandler, deleteTeamHandler } from '@/modules/projects/backend/routes/projects/[id]/team/handlers';
import { teamInputSchema, teamUpdateSchema } from '@/modules/projects/backend/routes/projects/[id]/team/schema';

export const GET = withProjectAccess(getTeamHandler);

export const POST = withProjectAccess(postTeamHandler, { schema: teamInputSchema });

export const PUT = withProjectAccess(putTeamHandler, { schema: teamUpdateSchema });

export const DELETE = withProjectAccess(deleteTeamHandler);
