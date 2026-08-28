import { withProjectAccess } from '@/lib/http/with-project-access';
import { putMilestonesMilestoneIdHandler, deleteMilestonesMilestoneIdHandler } from '@/modules/projects/backend/routes/projects/[id]/milestones/[milestoneId]/handlers';
import { milestoneUpdateSchema } from '../schema';

export const PUT = withProjectAccess(putMilestonesMilestoneIdHandler);

export const DELETE = withProjectAccess(deleteMilestonesMilestoneIdHandler);
