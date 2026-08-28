import { withProjectAccess } from '@/lib/http/with-project-access';
import { getMeetingsHandler, postMeetingsHandler, putMeetingsHandler, deleteMeetingsHandler } from '@/modules/projects/backend/routes/projects/[id]/meetings/handlers';
import { meetingInputSchema, meetingUpdateSchema } from '@/modules/projects/backend/routes/projects/[id]/meetings/schema';

export const GET = withProjectAccess(getMeetingsHandler);

export const POST = withProjectAccess(postMeetingsHandler, { schema: meetingInputSchema });

export const PUT = withProjectAccess(putMeetingsHandler, { schema: meetingUpdateSchema });

export const DELETE = withProjectAccess(deleteMeetingsHandler);
