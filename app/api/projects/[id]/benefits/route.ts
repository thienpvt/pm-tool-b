import { withProjectAccess } from '@/lib/http/with-project-access';
import { getBenefitsHandler, postBenefitsHandler, patchBenefitsHandler } from '@/modules/projects/backend/routes/projects/[id]/benefits/handlers';
import { benefitCreateSchema, benefitPatchSchema } from './schema';

export const GET = withProjectAccess(getBenefitsHandler);

export const POST = withProjectAccess(postBenefitsHandler);

export const PATCH = withProjectAccess(patchBenefitsHandler);
