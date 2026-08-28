import { withProgramAccess } from '@/lib/http/with-program-access';
import {
  deleteProgramHandler,
  getProgramHandler,
  putProgramHandler,
} from '@/modules/portfolio/backend/routes/programs/[id]/handlers';

export const GET = withProgramAccess(getProgramHandler);

export const PUT = withProgramAccess(putProgramHandler);

export const DELETE = withProgramAccess(deleteProgramHandler);
