import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { UnknownColumnError } from './_helpers';
import { ISSUE_COLUMNS, countIssues, createIssue, deleteIssue, listIssues, updateIssue } from './issues.repo';

describe.skipIf(!hasTestDb)('issues.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('issues Suite');
  });

  it('creates a row and reads it back', async () => {
    const created = await createIssue(projectId, { description: 'First', root_cause: 'Cause' }) as { id: number };
    const rows = await listIssues(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).toContain(created.id);
  });

  it('derives the display id from the row count when omitted', async () => {
    const before = await countIssues(projectId);
    const created = await createIssue(projectId, { description: 'Derived' }) as Record<string, string>;
    expect(created.issue_id).toBe('I' + (before + 1));
  });

  it('honors an explicit display id', async () => {
    const created = await createIssue(projectId, { issue_id: 'I999', description: 'Explicit' }) as Record<string, string>;
    expect(created.issue_id).toBe('I999');
  });

  it('persists the migration-added priority, impact and affected_activity_id', async () => {
    const created = await createIssue(projectId, {
      description: 'Migrated', priority: 'High', impact: 'Critical', affected_activity_id: 42,
    }) as { priority: string; impact: string; affected_activity_id: number };
    expect(created.priority).toBe('High');
    expect(created.impact).toBe('Critical');
    expect(created.affected_activity_id).toBe(42);
    for (const c of ['priority', 'impact', 'affected_activity_id']) expect(ISSUE_COLUMNS).toContain(c);
  });

  it('does not read another project rows', async () => {
    const other = await seedProject('Other issues');
    await createIssue(other, { description: 'Theirs' });
    const rows = await listIssues(projectId) as { description: string }[];
    expect(rows.map(r => r.description)).not.toContain('Theirs');
  });

  it('writes an allowlisted column', async () => {
    const created = await createIssue(projectId, { description: 'Before' }) as { id: number };
    const updated = await updateIssue(projectId, created.id, { status: 'Closed' }) as { status: string };
    expect(updated.status).toBe('Closed');
  });

  it('rejects an unknown column and leaves the row unchanged', async () => {
    const created = await createIssue(projectId, { description: 'Keep' }) as { id: number };
    await expect(updateIssue(projectId, created.id, { project_id: 999 })).rejects.toThrow(UnknownColumnError);
    const rows = await listIssues(projectId) as { id: number; description: string }[];
    expect(rows.find(r => r.id === created.id)?.description).toBe('Keep');
  });

  it('deletes only within the scoping project', async () => {
    const other = await seedProject('Delete Scope issues');
    const foreign = await createIssue(other, { description: 'Foreign' }) as { id: number };
    const res2 = await deleteIssue(projectId, foreign.id);
    expect(res2.changes).toBe(0);
  });
});
