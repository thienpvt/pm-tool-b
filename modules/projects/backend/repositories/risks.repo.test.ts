import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { UnknownColumnError } from '@/lib/repositories/_helpers';
import {
  RISK_COLUMNS,
  countRisks,
  createRisk,
  deactivateRisk,
  findRiskByCode,
  listOpenRisks,
  listRisks,
  updateRisk,
} from './risks.repo';

describe.skipIf(!hasTestDb)('risks.repo', () => {
  let projectId: number;

  beforeAll(async () => {
    await setupRepoTables();
    projectId = await seedProject('risks Suite');
  });

  it('creates a row and reads it back', async () => {
    const created = await createRisk(projectId, { description: 'First' }) as { id: number };
    const rows = await listRisks(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).toContain(created.id);
  });

  it('auto-generates zero-padded R-nnn code when omitted', async () => {
    const created = await createRisk(projectId, { description: 'Auto' }) as Record<string, string>;
    expect(created.code).toMatch(/^R-\d{3}$/);
    expect(created.risk_id).toBe(created.code);
  });

  it('increments auto code among existing R-nnn rows', async () => {
    const isolated = await seedProject('risks auto increment');
    await createRisk(isolated, { code: 'R-001', description: 'First coded' });
    const created = await createRisk(isolated, { description: 'Second auto' }) as Record<string, string>;
    expect(created.code).toBe('R-002');
  });

  it('honors an explicit code and populates risk_id from it', async () => {
    const created = await createRisk(projectId, { code: 'R-999', description: 'Explicit' }) as Record<string, string>;
    expect(created.code).toBe('R-999');
    expect(created.risk_id).toBe('R-999');
  });

  it('findRiskByCode matches case-insensitively within the project', async () => {
    const created = await createRisk(projectId, { code: 'R-010', description: 'Find me' }) as { id: number };
    const hit = await findRiskByCode(projectId, 'r-010');
    expect(hit?.id).toBe(created.id);
  });

  it('findRiskByCode excludes the given row id on update checks', async () => {
    const created = await createRisk(projectId, { code: 'R-011', description: 'Self' }) as { id: number };
    const hit = await findRiskByCode(projectId, 'R-011', created.id);
    expect(hit).toBeUndefined();
  });

  it('persists the migration-added priority, impact and affected_activity_id', async () => {
    const created = await createRisk(projectId, {
      description: 'Migrated', priority: 'High', impact: 'Critical', affected_activity_id: 42,
    }) as { priority: string; impact: string; affected_activity_id: number };
    expect(created.priority).toBe('High');
    expect(created.impact).toBe('Critical');
    expect(created.affected_activity_id).toBe(42);
    for (const c of ['priority', 'impact', 'affected_activity_id']) expect(RISK_COLUMNS).toContain(c);
  });

  it('includes code in RISK_COLUMNS', () => {
    expect(RISK_COLUMNS).toContain('code');
  });

  it('does not read another project rows', async () => {
    const other = await seedProject('Other risks');
    await createRisk(other, { description: 'Theirs' });
    const rows = await listRisks(projectId) as { description: string }[];
    expect(rows.map(r => r.description)).not.toContain('Theirs');
  });

  it('writes an allowlisted column', async () => {
    const created = await createRisk(projectId, { description: 'Before' }) as { id: number };
    const updated = await updateRisk(projectId, created.id, { status: 'Closed' }) as { status: string };
    expect(updated.status).toBe('Closed');
  });

  it('rejects an unknown column and leaves the row unchanged', async () => {
    const created = await createRisk(projectId, { description: 'Keep' }) as { id: number };
    await expect(updateRisk(projectId, created.id, { project_id: 999 })).rejects.toThrow(UnknownColumnError);
    const rows = await listRisks(projectId) as { id: number; description: string }[];
    expect(rows.find(r => r.id === created.id)?.description).toBe('Keep');
  });

  it('deactivates in place within the scoping project', async () => {
    const created = await createRisk(projectId, { description: 'Retire' }) as { id: number; status: string };
    const updated = await deactivateRisk(projectId, created.id) as { status: string; deactivated_at: string };
    expect(updated.status).toBe('deactivated');
    expect(updated.deactivated_at).toBeTruthy();
    const rows = await listRisks(projectId) as { id: number }[];
    expect(rows.map(r => r.id)).toContain(created.id);
  });

  it('deactivate returns undefined for a foreign project row', async () => {
    const other = await seedProject('Deactivate Scope risks');
    const foreign = await createRisk(other, { description: 'Foreign' }) as { id: number };
    const result = await deactivateRisk(projectId, foreign.id);
    expect(result).toBeUndefined();
  });

  describe('listOpenRisks ordering and is_overdue', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('orders High overdue before High not-overdue before Medium with is_overdue flag', async () => {
      const isolated = await seedProject('listOpenRisks order');
      await createRisk(isolated, {
        code: 'R-101', description: 'High overdue', priority: 'High', status: 'Open', due_date: '2026-08-20',
      });
      await createRisk(isolated, {
        code: 'R-102', description: 'High future', priority: 'High', status: 'Open', due_date: '2026-08-30',
      });
      await createRisk(isolated, {
        code: 'R-103', description: 'Medium overdue', priority: 'Medium', status: 'In Progress', due_date: '2026-08-15',
      });
      await createRisk(isolated, {
        code: 'R-104', description: 'Closed overdue', priority: 'High', status: 'Closed', due_date: '2026-08-10',
      });

      const rows = await listOpenRisks(isolated) as { description: string; is_overdue: boolean }[];
      expect(rows.map(r => r.description)).toEqual(['High overdue', 'High future', 'Medium overdue']);
      expect(rows[0].is_overdue).toBe(true);
      expect(rows[1].is_overdue).toBe(false);
      expect(rows[2].is_overdue).toBe(true);
    });
  });

  describe('listRisks ordering and is_overdue', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-08-26T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('orders Open/In Progress before Closed and never marks closed rows overdue', async () => {
      const isolated = await seedProject('listRisks order');
      await createRisk(isolated, {
        code: 'R-201', description: 'Closed High overdue', priority: 'High', status: 'Closed', due_date: '2026-08-10',
      });
      await createRisk(isolated, {
        code: 'R-202', description: 'Open Medium future', priority: 'Medium', status: 'Open', due_date: '2026-09-01',
      });
      await createRisk(isolated, {
        code: 'R-203', description: 'Open High overdue', priority: 'High', status: 'Open', due_date: '2026-08-10',
      });
      const deactivated = await createRisk(isolated, {
        code: 'R-204', description: 'Deactivated overdue', priority: 'High', status: 'Open', due_date: '2026-08-05',
      }) as { id: number };
      await deactivateRisk(isolated, deactivated.id);

      const rows = await listRisks(isolated) as { description: string; status: string; is_overdue: boolean }[];
      const openIdx = rows.findIndex(r => r.description === 'Open High overdue');
      const mediumIdx = rows.findIndex(r => r.description === 'Open Medium future');
      const closedIdx = rows.findIndex(r => r.description === 'Closed High overdue');
      const deactivatedIdx = rows.findIndex(r => r.description === 'Deactivated overdue');
      expect(openIdx).toBeLessThan(closedIdx);
      expect(mediumIdx).toBeLessThan(closedIdx);
      expect(rows[openIdx].is_overdue).toBe(true);
      expect(rows[closedIdx].is_overdue).toBe(false);
      expect(rows[deactivatedIdx].is_overdue).toBe(false);
    });
  });
});
