import { describe, expect, it } from 'vitest';
import {
  WEEKLY_REPORTS_DDL,
  WEEKLY_REPORTS_DDL_FLAG,
  WEEKLY_REPORTS_INDEX_DDL,
  migrateWeeklyReports,
} from './db-weekly-reports';

describe('migrateWeeklyReports DDL fragments', () => {
  it('exports migrateWeeklyReports and weekly_reports_ddl_v1 settings flag key', () => {
    expect(typeof migrateWeeklyReports).toBe('function');
    expect(WEEKLY_REPORTS_DDL_FLAG).toBe('weekly_reports_ddl_v1');
  });

  it('creates company_weekly_config, weekly_periods, weekly_reports, weekly_report_versions (D-02, D-14)', () => {
    const ddl = WEEKLY_REPORTS_DDL.join('\n');
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS company_weekly_config/);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS weekly_periods/);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS weekly_reports/);
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS weekly_report_versions/);
  });

  it('includes UNIQUE (company_id, iso_week) on weekly_periods (D-02)', () => {
    const ddl = WEEKLY_REPORTS_DDL.join('\n');
    expect(ddl).toMatch(/UNIQUE \(company_id, iso_week\)/);
  });

  it('includes named unique indexes weekly_reports_period_project_unique and weekly_report_versions_report_version_unique (D-04, D-08)', () => {
    const ddl = [...WEEKLY_REPORTS_DDL, ...WEEKLY_REPORTS_INDEX_DDL].join('\n');
    expect(ddl).toMatch(/weekly_reports_period_project_unique/);
    expect(ddl).toMatch(/weekly_report_versions_report_version_unique/);
  });

  it('includes shell status and draft columns on weekly_reports (D-05, D-06)', () => {
    const ddl = WEEKLY_REPORTS_DDL.join('\n');
    expect(ddl).toMatch(/status TEXT NOT NULL DEFAULT 'not_submitted'/);
    expect(ddl).toMatch(/highlights TEXT/);
    expect(ddl).toMatch(/draft_raid_json JSONB/);
  });
});
