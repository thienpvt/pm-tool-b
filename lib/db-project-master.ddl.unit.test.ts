import { describe, expect, it } from 'vitest';
import { PROJECT_MASTER_DDL, PROJECT_MASTER_DDL_FLAG } from './db-project-master';

describe('migrateProjectMaster DDL fragments', () => {
  it('exports project_master_ddl_v1 settings flag key', () => {
    expect(PROJECT_MASTER_DDL_FLAG).toBe('project_master_ddl_v1');
  });

  it('includes partial unique index projects_company_code_lower_unique on company_id and LOWER(project_code) (D-01)', () => {
    const ddl = PROJECT_MASTER_DDL.join('\n');
    expect(ddl).toMatch(/projects_company_code_lower_unique/);
    expect(ddl).toMatch(/LOWER\(project_code\)/);
    expect(ddl).toMatch(/company_id/);
    expect(ddl).toMatch(/project_code IS NOT NULL/);
    expect(ddl).toMatch(/TRIM\(project_code\)/);
  });

  it('adds progress_pct column on projects (D-09, PROJ-07)', () => {
    const ddl = PROJECT_MASTER_DDL.join('\n');
    expect(ddl).toMatch(/ADD COLUMN IF NOT EXISTS progress_pct/);
  });

  it('creates project_pm_assignments and project_stakeholders history tables (D-11, D-16)', () => {
    const ddl = PROJECT_MASTER_DDL.join('\n');
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS project_pm_assignments/);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS project_stakeholders/);
    expect(ddl).toMatch(/role IN \('primary','collaborator'\)/);
    expect(ddl).toMatch(
      /stakeholder_role IN \('sponsor','psc_chair','psc_member','project_director','key_stakeholder'\)/,
    );
  });
});
