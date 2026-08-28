import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  DASHBOARDS_DDL,
  DASHBOARDS_DDL_FLAG,
  migrateDashboards,
} from './db-dashboards';

describe('migrateDashboards DDL fragments', () => {
  it('exports migrateDashboards and dashboards_ddl_v1 settings flag key (D-07)', () => {
    expect(typeof migrateDashboards).toBe('function');
    expect(DASHBOARDS_DDL_FLAG).toBe('dashboards_ddl_v1');
  });

  it('creates dashboard_filter_state with PRIMARY KEY (user_id, surface) (D-07)', () => {
    const ddl = DASHBOARDS_DDL.join('\n');
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS dashboard_filter_state/);
    expect(ddl).toMatch(/user_id INTEGER NOT NULL REFERENCES users\(id\)/);
    expect(ddl).toMatch(/surface TEXT NOT NULL CHECK \(surface IN \('portfolio', 'pm'\)\)/);
    expect(ddl).toMatch(/filters_json JSONB NOT NULL DEFAULT '{}'/);
    expect(ddl).toMatch(/updated_at TIMESTAMPTZ NOT NULL DEFAULT now\(\)/);
    expect(ddl).toMatch(/PRIMARY KEY \(user_id, surface\)/);
  });
});

describe('getDb does not wire migrateDashboards (D-07, D-08)', () => {
  it('keeps migrateDashboards exported but getDb does not await it', () => {
    expect(typeof migrateDashboards).toBe('function');
    const src = readFileSync(resolve(__dirname, 'db.ts'), 'utf8');
    expect(src).not.toMatch(/await migrateDashboards\(pool\)/);
  });
});
