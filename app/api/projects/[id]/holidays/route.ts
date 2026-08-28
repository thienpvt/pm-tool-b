import { withProjectAccess } from '@/lib/http/with-project-access';
import { getHolidaysHandler, postHolidaysHandler, deleteHolidaysHandler } from '@/modules/projects/backend/routes/projects/[id]/holidays/handlers';
import { holidayInputSchema } from '@/modules/projects/backend/routes/projects/[id]/holidays/schema';

export const GET = withProjectAccess(getHolidaysHandler);

export const POST = withProjectAccess(postHolidaysHandler);

export const DELETE = withProjectAccess(deleteHolidaysHandler);
