import { withProgramAccess } from '@/lib/http/with-program-access';
import {
  getProgramProjectAllocationsHandler,
  postProgramProjectAllocationHandler,
} from '@/modules/portfolio/backend/routes/programs/[id]/project-allocations/handlers';

export const GET = withProgramAccess(getProgramProjectAllocationsHandler);

export const POST = withProgramAccess(postProgramProjectAllocationHandler);
