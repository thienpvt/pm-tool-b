import { withProjectAccess } from '@/lib/http/with-project-access';
import { getIssuesHandler, postIssuesHandler, putIssuesHandler, deleteIssuesHandler } from '@/modules/projects/backend/routes/projects/[id]/issues/handlers';
import { issueInputSchema, issueUpdateSchema } from '@/modules/projects/backend/routes/projects/[id]/issues/schema';

export const GET = withProjectAccess(getIssuesHandler);

export const POST = withProjectAccess(postIssuesHandler, { schema: issueInputSchema });

export const PUT = withProjectAccess(putIssuesHandler, { schema: issueUpdateSchema });

export const DELETE = withProjectAccess(deleteIssuesHandler);
