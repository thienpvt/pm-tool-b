import { withProjectAccess } from '@/lib/http/with-project-access';
import { getMilestonesHandler, postMilestonesHandler } from '@/modules/projects/backend/routes/projects/[id]/milestones/handlers';
import { milestoneInputSchema } from '@/modules/projects/backend/routes/projects/[id]/milestones/schema';

export const GET = withProjectAccess(getMilestonesHandler);

export const POST = withProjectAccess(postMilestonesHandler, { schema: milestoneInputSchema });
