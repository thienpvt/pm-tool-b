import { withProjectAccess } from '@/lib/http/with-project-access';
import { getDocumentsHandler, postDocumentsHandler, putDocumentsHandler, deleteDocumentsHandler } from '@/modules/projects/backend/routes/projects/[id]/documents/handlers';
import { documentInputSchema, documentUpdateSchema } from '@/modules/projects/backend/routes/projects/[id]/documents/schema';

export const GET = withProjectAccess(getDocumentsHandler);

export const POST = withProjectAccess(postDocumentsHandler);

export const PUT = withProjectAccess(putDocumentsHandler);

export const DELETE = withProjectAccess(deleteDocumentsHandler);
