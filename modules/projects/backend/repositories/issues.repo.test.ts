import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { UnknownColumnError } from './_helpers';
import {
  ISSUE_COLUMNS,
  countIssues,
  createIssue,
  deactivateIssue,
  findIssueByCode,
  listOpenIssues,
  listIssues,
  updateIssue,
} from './issues.repo';

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

  it('auto-generates zero-padded I-nnn code when omitted', async () => {
    const created = await createIssue(projectId, { description: 'Auto' }) as Record<string, string>;
    expect(created.code).toMatch(/^I-\d{3}$/);
    expect(created.issue_id).toBe(created.code);
  });

  it('increments auto code among existing I-nnn rows', async () => {
    const isolated = await seedProject('issues auto increment');
    await createIssue(isolated, { code: 'I-001', description: 'First coded' });
    const created = await createIssue(isolated, { description: 'Second auto' }) as Record<string, string>;
    expect(created.code).toBe('I-002');
  });

  it('honors an explicit code and populates issue_id from it', async () => {
    const created = await createIssue(projectId, { code: 'I-999', description: 'Explicit' }) as Record<string, string>;
    expect(created.code).toBe('I-999');
    expect(created.issue_id).toBe('I-999');
  });

  it('findIssueByCode matches case-insensitively within the project', async () => {
    const created = await createIssue(projectId, { code: 'I-010', description: 'Find me' }) as { id: number };
    const hit = await findIssueByCode(projectId, 'i-010');
    expect(hit?.id).toBe(created.id);
  });

  it('persists technology_council on update', async () => {
    const created = await createIssue(projectId, { description: 'Council' }) as { id: number };
    const updated = await updateIssue(projectId, created.id, { technology_council: true }) as {
      technology_council: boolean;
    };
    expect(updated.technology_council).toBe(true);
  });

  it('includes code and technology_council in ISSUE_COLUMNS', () => {
    expect(ISSUE_COLUMNS).toContain('code');
    expect(ISSUE_COLUMNS).toContain('technology_council');
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

  it('deactivates in place within the scoping project', async () => {
    const created = await createIssue(projectId, { description: 'Retire' }) as { id: number };
    const updated = await deactivateIssue(projectId, created.id) as { status: string; deactivated_at: string };
    expect(updated.status).toBe('deactivated');
    expect(updated.deactivated_at).toBeTruthy();
    const rows = await listIssues(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).toContain(created.id);
  });

  it('deactivate returns undefined for a foreign project row', async () => {
    const other = await seedProject('Deactivate Scope issues');
    const foreign = await createIssue(other, { description: 'Foreign' }) as { id: number };
    const result = await deactivateIssue(projectId, foreign.id);
    expect(result).toBeUndefined();
  });

  describe('listOpenIssues ordering and is_overdue', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('orders High overdue before High not-overdue before Medium with is_overdue flag', async () => {
      const isolated = await seedProject('listOpenIssues order');
      await createIssue(isolated, {
        code: 'I-101', description: 'High overdue', priority: 'High', status: 'Open', due_date: '2026-08-20',
      });
      await createIssue(isolated, {
        code: 'I-102', description: 'High future', priority: 'High', status: 'Open', due_date: '2026-08-30',
      });
      await createIssue(isolated, {
        code: 'I-103', description: 'Medium overdue', priority: 'Medium', status: 'In Progress', due_date: '2026-08-15',
      });
      await createIssue(isolated, {
        code: 'I-104', description: 'Closed overdue', priority: 'High', status: 'Closed', due_date: '2026-08-10',
      });

      const rows = await listOpenIssues(isolated) as { description: string; is_overdue: boolean }[];
      expect(rows.map(r => r.description)).toEqual(['High overdue', 'High future', 'Medium overdue']);
      expect(rows[0].is_overdue).toBe(true);
      expect(rows[1].is_overdue).toBe(false);
      expect(rows[2].is_overdue).toBe(true);
    });
  });

  describe('listIssues ordering and is_overdue', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('orders Open/In Progress before Closed and never marks closed rows overdue', async () => {
      const isolated = await seedProject('listIssues order');
      await createIssue(isolated, {
        code: 'I-201', description: 'Closed High overdue', priority: 'High', status: 'Closed', due_date: '2026-08-10',
      });
      await createIssue(isolated, {
        code: 'I-202', description: 'Open Medium future', priority: 'Medium', status: 'Open', due_date: '2026-09-01',
      });
      await createIssue(isolated, {
        code: 'I-203', description: 'Open High overdue', priority: 'High', status: 'Open', due_date: '2026-08-10',
      });

      const rows = await listIssues(isolated) as { description: string; status: string; is_overdue: boolean }[];
      const openIdx = rows.findIndex(r => r.description === 'Open High overdue');
      const mediumIdx = rows.findIndex(r => r.description === 'Open Medium future');
      const closedIdx = rows.findIndex(r => r.description === 'Closed High overdue');
      expect(openIdx).toBeLessThan(closedIdx);
      expect(mediumIdx).toBeLessThan(closedIdx);
      expect(rows[openIdx].is_overdue).toBe(true);
      expect(rows[closedIdx].is_overdue).toBe(false);
    });
  });
});
