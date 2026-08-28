import { describe, expect, it } from 'vitest';
import {
  RAID_MASTERS_DDL,
  RAID_MASTERS_DDL_FLAG,
  RAID_MASTERS_INDEX_DDL,
  migrateRaidMasters,
} from './db-raid-masters';

describe('migrateRaidMasters DDL fragments', () => {
  it('exports migrateRaidMasters and raid_masters_ddl_v1 settings flag key', () => {
    expect(typeof migrateRaidMasters).toBe('function');
    expect(RAID_MASTERS_DDL_FLAG).toBe('raid_masters_ddl_v1');
  });

  it('adds milestone lifecycle columns (D-01)', () => {
    const ddl = RAID_MASTERS_DDL.join('\n');
    expect(ddl).toMatch(/ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'planned'/);
    expect(ddl).toMatch(/ADD COLUMN IF NOT EXISTS plan_end TEXT/);
    expect(ddl).toMatch(/ADD COLUMN IF NOT EXISTS adjusted_end TEXT/);
    expect(ddl).toMatch(/ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ/);
    expect(ddl).toMatch(/ADD COLUMN IF NOT EXISTS cancelled_by INTEGER REFERENCES users\(id\)/);
  });

  it('adds RAID code and deactivate columns on risks and issues (D-05, D-12)', () => {
    const ddl = RAID_MASTERS_DDL.join('\n');
    expect(ddl).toMatch(/ALTER TABLE risks ADD COLUMN IF NOT EXISTS code TEXT/);
    expect(ddl).toMatch(/ALTER TABLE risks ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ/);
    expect(ddl).toMatch(/ALTER TABLE issues ADD COLUMN IF NOT EXISTS code TEXT/);
    expect(ddl).toMatch(/ALTER TABLE issues ADD COLUMN IF NOT EXISTS technology_council BOOLEAN DEFAULT FALSE/);
    expect(ddl).toMatch(/ALTER TABLE issues ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ/);
  });

  it('creates exactly one raid_due_date_history table (D-06, D-12)', () => {
    const ddl = RAID_MASTERS_DDL.join('\n');
    const createTables = ddl.match(/CREATE TABLE IF NOT EXISTS (\w+)/g) ?? [];
    expect(createTables).toHaveLength(1);
    expect(createTables[0]).toBe('CREATE TABLE IF NOT EXISTS raid_due_date_history');
    expect(ddl).toMatch(/entity_type TEXT NOT NULL CHECK \(entity_type IN \('risk','issue'\)\)/);
  });

  it('includes partial unique index names risks_project_code_lower_unique and issues_project_code_lower_unique (D-05)', () => {
    const ddl = [...RAID_MASTERS_DDL, ...RAID_MASTERS_INDEX_DDL].join('\n');
    expect(ddl).toMatch(/risks_project_code_lower_unique/);
    expect(ddl).toMatch(/issues_project_code_lower_unique/);
    expect(ddl).toMatch(/LOWER\(code\)/);
    expect(ddl).toMatch(/project_id/);
  });
});
