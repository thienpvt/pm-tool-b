import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const DATA_FIXES_DIR = path.resolve(import.meta.dirname, '../../scripts/data-fixes');
const SKIP_FILES = new Set(['run-sql-fix.ts']);

const SQL_TEMPLATE = /sql\s*:\s*`([\s\S]*?)`/i;
const SQL_START = /^(UPDATE|INSERT|SELECT)/i;

/** Boot UPDATE scripts (01–04) must expose a sql template starting with DML. */
const BOOT_UPDATE_SCRIPTS = [
  '01-users-onboarding-completed.ts',
  '02-portfolio-members-member-type.ts',
  '03-projects-company-id-sync.ts',
  '04-activities-jira-parent-repair.ts',
] as const;

/** v2.0 backfill operator scripts — sql template or exported helper/flag reference. */
const BACKFILL_SCRIPTS: { file: string; marker: RegExp }[] = [
  { file: 'backfill-weighted-completion.ts', marker: /completion_pct_weighted_v1/ },
  { file: 'backfill-user-roles.ts', marker: /backfillUserRoles/ },
  { file: 'backfill-pm-assignments.ts', marker: /backfillPmAssignments/ },
  { file: 'backfill-raid-masters.ts', marker: /backfillRaidMasters/ },
  { file: 'backfill-mapping-tenant.ts', marker: /migrateMappingTableTenancy/ },
];

function readScript(filename: string): string {
  return readFileSync(path.join(DATA_FIXES_DIR, filename), 'utf8');
}

function listDataFixScripts(): string[] {
  return readdirSync(DATA_FIXES_DIR)
    .filter((f) => f.endsWith('.ts') && !SKIP_FILES.has(f))
    .sort();
}

describe('scripts/data-fixes (DATA-03, D-02)', () => {
  it('run-sql-fix.ts exports runFix and requires DATABASE_URL', () => {
    const src = readFileSync(path.join(DATA_FIXES_DIR, 'run-sql-fix.ts'), 'utf8');
    expect(src).toMatch(/export async function runFix/);
    expect(src).toMatch(/DATABASE_URL/);
    expect(src).toMatch(/resolveSsl/);
  });

  it('each boot UPDATE script (01–04) has sql template starting with UPDATE', () => {
    for (const file of BOOT_UPDATE_SCRIPTS) {
      const src = readScript(file);
      const match = src.match(SQL_TEMPLATE);
      expect(match, `${file} missing sql template`).not.toBeNull();
      const trimmed = match![1].trim();
      expect(trimmed, `${file} sql must start with UPDATE`).toMatch(/^UPDATE/i);
    }
  });

  it('each v2.0 backfill script exists with sql template or helper/flag marker', () => {
    for (const { file, marker } of BACKFILL_SCRIPTS) {
      const src = readScript(file);
      const match = src.match(SQL_TEMPLATE);
      if (match) {
        expect(match[1].trim(), `${file} sql template`).toMatch(SQL_START);
      } else {
        expect(src, `${file} helper/flag marker`).toMatch(marker);
      }
    }
  });

  it('every other .ts script under scripts/data-fixes has sql or helper reference', () => {
    const files = listDataFixScripts();
    expect(files.length).toBeGreaterThan(0);

    const helperOrFlagPatterns = [
      /backfillUserRoles/,
      /backfillPmAssignments/,
      /backfillRaidMasters/,
      /migrateMappingTableTenancy/,
      /completion_pct_weighted_v1/,
    ];

    for (const file of files) {
      const src = readScript(file);
      const match = src.match(SQL_TEMPLATE);
      if (match) {
        expect(match[1].trim(), `${file} sql template`).toMatch(SQL_START);
      } else {
        const hasHelper = helperOrFlagPatterns.some((p) => p.test(src));
        expect(hasHelper, `${file} must have sql template or backfill helper`).toBe(true);
      }
    }
  });
});
