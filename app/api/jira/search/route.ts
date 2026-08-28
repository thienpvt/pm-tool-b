import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/http/with-auth';
import { integrationErrorResponse } from '@/lib/api-errors';
import { resolveJiraCredentials } from '@/lib/integrations/credentials';
import { searchIssues } from '@/lib/integrations/jira/client';
import { jiraSearchSchema } from './schema';

export const POST = withAuth(async (_req, { user, body }) => {
  if (!user.company_id) {
    return NextResponse.json(
      {
        error:
          'Jira chưa được cấu hình cho công ty này. Admin cần vào trang Quản trị → Companies → Cấu hình Jira.',
      },
      { status: 401 },
    );
  }

  const creds = await resolveJiraCredentials(user.company_id);
  if (!creds) {
    return NextResponse.json(
      {
        error:
          'Jira chưa được cấu hình cho công ty này. Admin cần vào trang Quản trị → Companies → Cấu hình Jira.',
      },
      { status: 503 },
    );
  }

  const { jql, nextPageToken, maxResults = 100, extraFields = [] } = body;
  if (!jql) {
    return NextResponse.json({ error: 'jql là bắt buộc' }, { status: 400 });
  }

  try {
    const { issues, total, nextPageToken: token } = await searchIssues(creds, {
      jql,
      nextPageToken,
      maxResults,
      extraFields,
    });

    return NextResponse.json({
      issues,
      total,
      nextPageToken: token,
    });
  } catch (err) {
    return integrationErrorResponse(err);
  }
}, { schema: jiraSearchSchema });
