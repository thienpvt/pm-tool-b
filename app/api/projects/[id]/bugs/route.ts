import { withProjectAccess } from '@/lib/http/with-project-access';
import { getBugsHandler, postBugsHandler, deleteBugsHandler } from '@/modules/projects/backend/routes/projects/[id]/bugs/handlers';
import { bugsInputSchema } from '@/modules/projects/backend/routes/projects/[id]/bugs/schema';

export const GET = withProjectAccess(getBugsHandler);

export const POST = withProjectAccess(postBugsHandler, { schema: bugsInputSchema });

export const DELETE = withProjectAccess(deleteBugsHandler);
