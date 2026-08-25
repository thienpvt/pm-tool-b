import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { fetchMock } = vi.hoisted(() => ({ fetchMock: vi.fn() }));

import { listFields, searchIssues, testConnection } from './client';
import type { JiraCredentials } from '@/lib/integrations/credentials';

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) } as Response;
}

const creds: JiraCredentials = { baseUrl: 'https://pm.atlassian.net', email: 'e', token: 't' };
const basic = 'Basic ' + Buffer.from('e:t').toString('base64');

const happyIssues = {
  issues: [{
    key: 'K-1',
    id: '1',
    fields: {
      summary: 'S',
      issuetype: { name: 'Bug' },
      status: { name: 'Open' },
      assignee: { displayName: 'A' },
      reporter: { displayName: 'R' },
      priority: { name: 'High' },
      labels: [],
      components: [],
      created: '2026-01-01',
    },
  }],
  total: 1,
  nextPageToken: null,
};

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('searchIssues', () => {
  it('resolves issues/total/nextPageToken and POSTs with Basic auth', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, happyIssues));

    await expect(searchIssues(creds, { jql: 'project = K' })).resolves.toEqual({
      issues: happyIssues.issues,
      total: 1,
      nextPageToken: null,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://pm.atlassian.net/rest/api/3/search/jql',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: basic }),
      }),
    );
    const [, init] = fetchMock.mock.calls[0];
    const sent = JSON.parse(init.body);
    expect(sent).toEqual({ jql: 'project = K', maxResults: 100, fields: expect.arrayContaining(['key', 'summary', 'customfield_1185']) });
  });

  it('accepts null custom fields that Jira returns for unset values (CR-01)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      issues: [{
        key: 'K-2',
        id: '2',
        fields: {
          summary: 'S',
          issuetype: { name: 'Bug' },
          status: { name: 'Open' },
          assignee: { displayName: 'A' },
          reporter: { displayName: 'R' },
          priority: { name: 'High' },
          labels: [],
          components: [],
          created: '2026-01-01',
          customfield_10014: null,
          customfield_10016: null,
          customfield_10020: null,
        },
      }],
      total: 1,
      nextPageToken: null,
    }));

    const assertion = expect(searchIssues(creds, { jql: 'project = K' })).resolves.toMatchObject({
      total: 1,
      issues: [{ key: 'K-2' }],
    });
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it('accepts a null epic-link string among otherwise populated custom fields', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {
      issues: [{
        key: 'K-3',
        id: '3',
        fields: {
          summary: 'S',
          issuetype: { name: 'Bug' },
          status: { name: 'Open' },
          assignee: { displayName: 'A' },
          reporter: { displayName: 'R' },
          priority: { name: 'High' },
          labels: [],
          components: [],
          created: '2026-01-01',
          customfield_10014: null,
          customfield_10016: 5,
          customfield_10020: [{ name: 'S1', state: 'active' }],
        },
      }],
      total: 1,
      nextPageToken: null,
    }));

    const assertion = expect(searchIssues(creds, { jql: 'project = K' })).resolves.toMatchObject({
      total: 1,
      issues: [{ key: 'K-3' }],
    });
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it('resolves an empty result set with total 0 and no issues (WR-02)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { issues: [], total: 0, nextPageToken: null }));

    const assertion = expect(searchIssues(creds, { jql: 'project = NONE' })).resolves.toEqual({
      issues: [],
      total: 0,
      nextPageToken: null,
    });
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it('rejects kind upstream with the parsed errorMessages on a 400', async () => {
    fetchMock.mockResolvedValue(jsonResponse(400, { errorMessages: ['jql error'] }));

    const assertion = expect(searchIssues(creds, { jql: 'bad' }))
      .rejects.toMatchObject({ kind: 'upstream', service: 'jira', status: 400 });
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it('falls back to the message field when errorMessages is absent', async () => {
    fetchMock.mockResolvedValue(jsonResponse(500, { message: 'boom' }));

    const assertion = expect(searchIssues(creds, { jql: 'bad' }))
      .rejects.toMatchObject({ kind: 'upstream', service: 'jira', status: 500, cause: { message: 'boom' } });
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it('rejects kind validation on a malformed 2xx response (INTG-05/10)', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { issues: 'nope' }));

    const assertion = expect(searchIssues(creds, { jql: 'x' }))
      .rejects.toMatchObject({ kind: 'validation', service: 'jira' });
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it('rejects kind timeout when the request hangs past 15s', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));

    const assertion = expect(searchIssues(creds, { jql: 'x' }))
      .rejects.toMatchObject({ kind: 'timeout', service: 'jira' });
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
  });

  it('rejects kind network when fetch rejects', async () => {
    fetchMock.mockRejectedValue(new Error('ECONNRESET'));

    const assertion = expect(searchIssues(creds, { jql: 'x' }))
      .rejects.toMatchObject({ kind: 'network', service: 'jira' });
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it('rejects kind network (never timeout) when the caller signal aborts', async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    const controller = new AbortController();

    const assertion = expect(searchIssues(creds, { jql: 'x', signal: controller.signal }))
      .rejects.toMatchObject({ kind: 'network', service: 'jira' });
    controller.abort();
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });
});

describe('listFields', () => {
  it('returns only custom fields mapped to {id, name, type} sorted by name', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, [
      { id: 'summary', name: 'Summary', custom: false },
      { id: '10014', name: 'Epic Link', custom: true, schema: { type: 'option' } },
      { id: '10015', name: 'Start date', custom: true },
      { id: '10016', name: 'Story Points', custom: true, schema: { type: 'number' } },
    ]));

    await expect(listFields(creds)).resolves.toEqual([
      { id: '10014', name: 'Epic Link', type: 'option' },
      { id: '10015', name: 'Start date', type: '' },
      { id: '10016', name: 'Story Points', type: 'number' },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://pm.atlassian.net/rest/api/3/field',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: basic }) }),
    );
  });
});

describe('testConnection', () => {
  it('resolves displayName, emailAddress and accountId', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, { displayName: 'D', emailAddress: 'e@x', accountId: 'a' }));

    await expect(testConnection(creds)).resolves.toEqual({ displayName: 'D', emailAddress: 'e@x', accountId: 'a' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://pm.atlassian.net/rest/api/3/myself',
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: basic }) }),
    );
  });
});
