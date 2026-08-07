import { beforeAll, describe, expect, it, vi } from 'vitest';
import { hasTestDb } from '../../test/db';
import { seedProject, setupRepoTables, testDb } from '../../test/repo-db';

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => testDb()) }));

import { UnknownColumnError } from './_helpers';
import { RISK_COLUMNS, countRisks, createRisk, deleteRisk, listRisks, updateRisk } from './risks.repo';

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

  it('derives the display id from the row count when omitted', async () => {
    const before = await countRisks(projectId);
    const created = await createRisk(projectId, { description: 'Derived' }) as Record<string, string>;
    expect(created.risk_id).toBe('R' + (before + 1));
  });

  it('honors an explicit display id', async () => {
    const created = await createRisk(projectId, { risk_id: 'R999', description: 'Explicit' }) as Record<string, string>;
    expect(created.risk_id).toBe('R999');
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

  it('deletes only within the scoping project', async () => {
    const other = await seedProject('Delete Scope risks');
    const foreign = await createRisk(other, { description: 'Foreign' }) as { id: number };
    const res2 = await deleteRisk(projectId, foreign.id);
    expect(res2.changes).toBe(0);
  });
});
