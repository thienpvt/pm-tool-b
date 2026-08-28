import { withProjectAccess } from '@/lib/http/with-project-access';
import { getRisksHandler, postRisksHandler, putRisksHandler, deleteRisksHandler } from '@/modules/projects/backend/routes/projects/[id]/risks/handlers';
import { riskInputSchema, riskUpdateSchema } from '@/modules/projects/backend/routes/projects/[id]/risks/schema';

export const GET = withProjectAccess(getRisksHandler);

export const POST = withProjectAccess(postRisksHandler, { schema: riskInputSchema });

export const PUT = withProjectAccess(putRisksHandler, { schema: riskUpdateSchema });

export const DELETE = withProjectAccess(deleteRisksHandler);
