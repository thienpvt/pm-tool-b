import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMigrationFile } from './plan';

const BASELINE_PATH = path.resolve(
  import.meta.dirname,
  '../../migrations/0001-baseline-schema.sql',
);

const V2_TABLES = [
  'weekly_periods',
  'audit_logs',
  'user_roles',
  'project_fiscal_budgets',
  'document_catalog',
  'dashboard_filter_state',
  'raid_due_date_history',
  'project_pm_assignments',
] as const;

const BOOT_FINGERPRINTS = [
  /onboarding_completed\s*=\s*1\s+WHERE\s+created_at/i,
  /member_type\s*=\s*'external'/i,
  /UPDATE\s+projects\s+SET\s+company_id/i,
  /SET\s+parent_id\s*=\s*e\.id/i,
] as const;

function readBaseline(): string {
  return readFileSync(BASELINE_PATH, 'utf8');
}

/** Split migration SQL on semicolon-newline boundaries (ignores comment-only fragments). */
function splitSqlStatements(sql: string): string[] {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !/^--[^\n]*$/m.test(s));
}

/** Fail if two DDL/DML statements appear concatenated without a semicolon terminator. */
function assertStatementsTerminated(sql: string): void {
  const withoutComments = sql.replace(/^--[^\n]*\n/gm, '');
  const badJoin = withoutComments.match(
    /\)\s*\n\s*(CREATE|ALTER|INSERT|UPDATE|DO\s+\$\$)/i,
  );
  expect(badJoin).toBeNull();
}

describe('0001-baseline-schema.sql content (DATA-02, D-02, D-03, D-04, D-09)', () => {
  it('parses as version 1 via parseMigrationFile', () => {
    const sql = readBaseline();
    const parsed = parseMigrationFile('0001-baseline-schema.sql', sql);
    expect(parsed.version).toBe(1);
    expect(parsed.filename).toBe('0001-baseline-schema.sql');
    expect(parsed.checksum).toMatch(/^[a-f0-9]{64}$/);
  });

  it('has three labelled parts', () => {
    const sql = readBaseline();
    expect(sql).toMatch(/Part 1:/i);
    expect(sql).toMatch(/Part 2:/i);
    expect(sql).toMatch(/Part 3:/i);
  });

  it('includes v2.0 table names (D-03)', () => {
    const sql = readBaseline();
    for (const table of V2_TABLES) {
      expect(sql).toMatch(new RegExp(table));
    }
  });

  it('contains no DROP TABLE (D-04)', () => {
    const sql = readBaseline();
    expect(sql).not.toMatch(/DROP TABLE/i);
  });

  it('excludes four boot data-fix UPDATE fingerprints (19-03 scope)', () => {
    const sql = readBaseline();
    for (const pattern of BOOT_FINGERPRINTS) {
      expect(sql).not.toMatch(pattern);
    }
  });

  it('orders RAID DDL before backfill DML before unique indexes (D-09)', () => {
    const sql = readBaseline();
    const ddlMarker = sql.indexOf('ALTER TABLE risks ADD COLUMN IF NOT EXISTS code');
    const backfillMarker = sql.indexOf('UPDATE milestones SET plan_end = end_date');
    const indexMarker = sql.indexOf('risks_project_code_lower_unique');
    expect(ddlMarker).toBeGreaterThan(-1);
    expect(backfillMarker).toBeGreaterThan(-1);
    expect(indexMarker).toBeGreaterThan(-1);
    expect(ddlMarker).toBeLessThan(backfillMarker);
    expect(backfillMarker).toBeLessThan(indexMarker);
  });

  it('is not the origin v1.0 baseline (D-02)', () => {
    const sql = readBaseline();
    expect(sql).toMatch(/weekly_periods/);
    expect(sql).toMatch(/user_roles/);
  });

  it('splits into multiple terminated SQL statements (semicolon presence)', () => {
    const sql = readBaseline();
    assertStatementsTerminated(sql);
    const statements = splitSqlStatements(sql);
    expect(statements.length).toBeGreaterThan(1);
    expect(statements.some((s) => /^CREATE TABLE/i.test(s))).toBe(true);
    expect(statements.some((s) => /^ALTER TABLE/i.test(s))).toBe(true);
  });
});
