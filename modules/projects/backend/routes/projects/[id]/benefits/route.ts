import { withProjectAccess } from '@/lib/http/with-project-access';
import {
  getBenefitsHandler,
  patchBenefitsHandler,
  postBenefitsHandler,
} from './handlers';
import { benefitCreateSchema, benefitPatchSchema } from './schema';

export const GET = withProjectAccess(getBenefitsHandler);

export const POST = withProjectAccess(postBenefitsHandler, { schema: benefitCreateSchema });

export const PATCH = withProjectAccess(patchBenefitsHandler, { schema: benefitPatchSchema });
