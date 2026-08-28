import { withProjectAccess } from '@/lib/http/with-project-access';
import { getMilestonesMilestoneIdEpicsHandler, postMilestonesMilestoneIdEpicsHandler, deleteMilestonesMilestoneIdEpicsHandler } from '@/modules/projects/backend/routes/projects/[id]/milestones/[milestoneId]/epics/handlers';
import { epicInputSchema } from '@/modules/projects/backend/routes/projects/[id]/milestones/[milestoneId]/epics/schema';

export const GET = withProjectAccess(getMilestonesMilestoneIdEpicsHandler);

export const POST = withProjectAccess(postMilestonesMilestoneIdEpicsHandler, { schema: epicInputSchema });

export const DELETE = withProjectAccess(deleteMilestonesMilestoneIdEpicsHandler);
