import { z } from 'zod';

const jiraUser = z.object({ displayName: z.string() }).nullable();
const jiraOption = z.object({ name: z.string() }).nullable();

// Fields consumed per issue: key, id, fields.summary, fields.issuetype.name,
// fields.status.name, fields.assignee.displayName, fields.reporter.displayName,
// fields.priority.name, fields.labels[], fields.components[].name, fields.parent.key,
// fields.customfield_10014, _10015, _10016, _10020, fields.resolution.name,
// fields.created, fields.duedate — plus arbitrary virtual columns read by callers
// via extractOptionValue, so the schema must passthrough fields.
const jiraIssueSchema = z.object({
  key: z.string(),
  id: z.union([z.string(), z.number()]),
  fields: z.object({
    summary: z.string(),
    issuetype: z.object({ name: z.string() }),
    status: z.object({ name: z.string() }),
    assignee: jiraUser,
    reporter: jiraUser,
    priority: jiraOption,
    labels: z.array(z.string()),
    components: z.array(z.object({ name: z.string() })),
    parent: z.object({ key: z.string() }).optional(),
    customfield_10014: z.string().optional(),            // Epic Link (classic)
    customfield_10015: z.string().nullable().optional(), // Start date (Jira Cloud)
    customfield_10016: z.number().optional(),            // Story Points
    customfield_10020: z.array(z.object({ name: z.string(), state: z.string() })).or(z.string()).optional(), // Sprint
    resolution: z.object({ name: z.string() }).nullable().optional(),
    created: z.string(),
    duedate: z.string().nullable().optional(),
  }).passthrough(),
}).passthrough();

// POST /rest/api/3/search/jql envelope. 'issues'/'total'/'nextPageToken' are what
// the route consumes; everything else passes through so an upstream addition
// never 502s (Pitfall 7).
export const jiraSearchResponseSchema = z.object({
  issues: z.array(jiraIssueSchema).default([]),
  total: z.number().optional(),
  nextPageToken: z.string().nullable().optional(),
}).passthrough();

// GET /rest/api/3/field — fields consumed: id, name, custom, schema.type.
export const jiraFieldSchema = z.object({
  id: z.string(),
  name: z.string(),
  custom: z.boolean(),
  schema: z.object({ type: z.string() }).optional(),
}).passthrough();

// GET /rest/api/3/myself — consumed: displayName, emailAddress, accountId.
export const jiraMeSchema = z.object({
  displayName: z.string(),
  emailAddress: z.string(),
  accountId: z.string(),
}).passthrough();
