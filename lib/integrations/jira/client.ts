import { z } from 'zod';
import { IntegrationError, withFetchTimeout } from '@/lib/integrations/errors';
import type { JiraCredentials } from '@/lib/integrations/credentials';
import { jiraFieldSchema, jiraMeSchema, jiraSearchResponseSchema } from './schemas';

export type SearchIssuesParams = {
  jql: string;
  nextPageToken?: string;
  maxResults?: number;
  extraFields?: string[];
  signal?: AbortSignal; // optional caller abort, distinct from the 15s timeout
};

// The search route's field list verbatim, kept at module scope (CONTEXT
// discretion: a single caller today). Deduped against params.extraFields.
const FIELDS = [
  'key', 'summary', 'issuetype', 'status', 'assignee', 'reporter',
  'priority', 'created', 'duedate', 'labels', 'components', 'parent',
  'customfield_10014', // Epic Link (classic)
  'customfield_10008', // Epic Name
  'customfield_10015', // Start date (Jira Cloud)
  'customfield_10016', // Story Points
  'resolution',
  'customfield_10020', // Sprint (next-gen / team-managed)
  'customfield_1185',  // Severity (migrated)
];

function basicAuth(email: string, token: string) {
  return 'Basic ' + Buffer.from(`${email}:${token}`).toString('base64');
}

/**
 * Search issues via the Jira Cloud cursor endpoint (POST /rest/api/3/search/jql).
 * Upstream error bodies are parsed the same way the old search route did:
 * `errorMessages.join('; ')` fallback to `message`, else the generic status
 * string. Upstream message strings are preserved for the route mapper.
 */
export async function searchIssues(
  creds: JiraCredentials,
  params: SearchIssuesParams,
): Promise<{ issues: unknown[]; total: number; nextPageToken: string | null }> {
  const allFields = [...new Set([...FIELDS, ...(params.extraFields ?? [])])];
  const body: Record<string, unknown> = {
    jql: params.jql,
    maxResults: params.maxResults ?? 100,
    fields: allFields,
  };
  if (params.nextPageToken) body.nextPageToken = params.nextPageToken;

  const { value: response, error } = await withFetchTimeout(fetch(
    `${creds.baseUrl}/rest/api/3/search/jql`,
    {
      method: 'POST',
      headers: {
        Authorization: basicAuth(creds.email, creds.token),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: params.signal,
    },
  ), 15_000, params.signal, 'jira');
  if (error) throw error;

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = `Jira trả về lỗi ${response.status}`;
    try {
      const errJson = JSON.parse(errText);
      if (errJson.errorMessages?.length) errMsg = errJson.errorMessages.join('; ');
      else if (errJson.message) errMsg = errJson.message;
    } catch { /* keep default */ }
    throw new IntegrationError({
      kind: 'upstream',
      service: 'jira',
      status: response.status,
      message: errMsg,
      cause: { message: errMsg },
    });
  }

  const parsed = jiraSearchResponseSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new IntegrationError({ kind: 'validation', service: 'jira', cause: parsed.error });
  }
  return {
    issues: parsed.data.issues,
    total: parsed.data.total ?? parsed.data.issues.length,
    nextPageToken: parsed.data.nextPageToken ?? null,
  };
}

/**
 * List Jira fields; only custom fields, mapped to {id, name, type} and sorted
 * by name — matching the fields route's current output. Upstream non-ok maps
 * to the fields route's `Jira error ${status}` string via the route mapper.
 */
export async function listFields(
  creds: JiraCredentials,
): Promise<Array<{ id: string; name: string; type: string }>> {
  const { value: response, error } = await withFetchTimeout(fetch(
    `${creds.baseUrl}/rest/api/3/field`,
    { headers: { Authorization: basicAuth(creds.email, creds.token), Accept: 'application/json' } },
  ), 15_000, undefined, 'jira');
  if (error) throw error;

  if (!response.ok) {
    throw new IntegrationError({
      kind: 'upstream',
      service: 'jira',
      status: response.status,
      message: `Jira error ${response.status}`,
      cause: { message: `Jira error ${response.status}` },
    });
  }

  const parsed = z.array(jiraFieldSchema).safeParse(await response.json());
  if (!parsed.success) {
    throw new IntegrationError({ kind: 'validation', service: 'jira', cause: parsed.error });
  }
  return parsed.data
    .filter(f => f.custom)
    .map(f => ({ id: f.id, name: f.name, type: f.schema?.type ?? '' }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Test a Jira connection via GET /rest/api/3/myself. Upstream message is
 * extracted from the JSON body (`message` field) with the test route's
 * `Jira trả về ${status}` fallback; the route mapper preserves it.
 */
export async function testConnection(
  creds: JiraCredentials,
): Promise<{ displayName: string; emailAddress: string; accountId: string }> {
  const { value: response, error } = await withFetchTimeout(fetch(
    `${creds.baseUrl}/rest/api/3/myself`,
    { headers: { Authorization: basicAuth(creds.email, creds.token), Accept: 'application/json' } },
  ), 15_000, undefined, 'jira');
  if (error) throw error;

  if (!response.ok) {
    const errText = await response.text();
    let errMsg = `Jira trả về ${response.status}`;
    try {
      const j = JSON.parse(errText);
      if (j.message) errMsg = j.message;
    } catch { /* keep */ }
    throw new IntegrationError({
      kind: 'upstream',
      service: 'jira',
      status: response.status,
      message: errMsg,
      cause: { message: errMsg },
    });
  }

  const parsed = jiraMeSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new IntegrationError({ kind: 'validation', service: 'jira', cause: parsed.error });
  }
  return parsed.data;
}
