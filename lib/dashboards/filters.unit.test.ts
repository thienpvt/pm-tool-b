import { describe, expect, it } from 'vitest';
import { ValidationError } from '@/lib/services/errors';
import {
  applyDashboardFilters,
  parseDashboardFilters,
  type FilterableProjectRow,
} from './filters';

const rows: FilterableProjectRow[] = [
  {
    id: 1,
    portfolio_year: 2026,
    customer_id: 10,
    pm_user_id: 100,
    stage: 'L2',
    status: 'Active',
    rag: 'Green',
    classification: 'Strategic',
    weekly_report_enabled: true,
  },
  {
    id: 2,
    portfolio_year: 2026,
    customer_id: 20,
    pm_user_id: 200,
    stage: 'L3',
    status: 'Active',
    rag: 'Amber',
    classification: 'Run',
    weekly_report_enabled: false,
  },
  {
    id: 3,
    portfolio_year: 2025,
    customer_id: 10,
    pm_user_id: 100,
    stage: 'L2',
    status: 'Closed',
    rag: 'Red',
    classification: 'Strategic',
    weekly_report_enabled: true,
  },
];

describe('parseDashboardFilters (D-06)', () => {
  it('accepts known keys and omits null/empty values', () => {
    expect(parseDashboardFilters({ stage: 'L2', rag: '', status: null })).toEqual({ stage: 'L2' });
  });

  it('throws ValidationError on unknown key', () => {
    expect(() => parseDashboardFilters({ bogus: 'x' })).toThrow(ValidationError);
  });
});

describe('applyDashboardFilters AND matrix (D-06)', () => {
  it('filters portfolio_year', () => {
    expect(applyDashboardFilters(rows, { portfolio_year: 2026 }).map((r) => r.id)).toEqual([1, 2]);
  });

  it('filters program via customer_id', () => {
    expect(applyDashboardFilters(rows, { program: 10 }).map((r) => r.id)).toEqual([1, 3]);
  });

  it('filters pm_user_id', () => {
    expect(applyDashboardFilters(rows, { pm_user_id: 200 }).map((r) => r.id)).toEqual([2]);
  });

  it('filters stage, status, rag (case-normalized)', () => {
    expect(applyDashboardFilters(rows, { stage: 'L2', status: 'Active' }).map((r) => r.id)).toEqual([1]);
    expect(applyDashboardFilters(rows, { rag: 'green' }).map((r) => r.id)).toEqual([1]);
  });

  it('filters type via classification', () => {
    expect(applyDashboardFilters(rows, { type: 'Run' }).map((r) => r.id)).toEqual([2]);
  });

  it('filters weekly_report_enabled', () => {
    expect(applyDashboardFilters(rows, { weekly_report_enabled: false }).map((r) => r.id)).toEqual([2]);
  });

  it('unit present is a no-op and does not narrow', () => {
    const withUnit = applyDashboardFilters(rows, { unit: 'ignored', stage: 'L2' });
    const withoutUnit = applyDashboardFilters(rows, { stage: 'L2' });
    expect(withUnit.map((r) => r.id)).toEqual(withoutUnit.map((r) => r.id));
    expect(withUnit.map((r) => r.id)).toEqual([1, 3]);
  });

  it('AND-combines multiple present keys', () => {
    expect(
      applyDashboardFilters(rows, {
        portfolio_year: 2026,
        program: 10,
        stage: 'L2',
        status: 'Active',
      }).map((r) => r.id),
    ).toEqual([1]);
  });
});
