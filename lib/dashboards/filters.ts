import { ValidationError } from '@/lib/services/errors';
import { normalizeRag } from './rag';

export const DASHBOARD_FILTER_KEYS = [
  'portfolio_year',
  'program',
  'unit',
  'pm_user_id',
  'stage',
  'status',
  'rag',
  'type',
  'weekly_report_enabled',
] as const;

export type DashboardFilterKey = (typeof DASHBOARD_FILTER_KEYS)[number];
export type DashboardFilters = Partial<Record<DashboardFilterKey, unknown>>;

export type FilterableProjectRow = {
  id: number;
  portfolio_year?: number | null;
  customer_id?: number | null;
  pm_user_id?: number | null;
  stage?: string | null;
  status?: string;
  rag?: string | null;
  classification?: string | null;
  weekly_report_enabled?: boolean | null;
};

export function parseDashboardFilters(input: Record<string, unknown>): DashboardFilters {
  const filters: DashboardFilters = {};
  for (const [key, value] of Object.entries(input)) {
    if (!(DASHBOARD_FILTER_KEYS as readonly string[]).includes(key)) {
      throw new ValidationError(`Unknown filter key: ${key}`, key);
    }
    if (value === null || value === undefined || value === '') continue;
    (filters as Record<string, unknown>)[key] = value;
  }
  return filters;
}

function matchesFilter(row: FilterableProjectRow, key: DashboardFilterKey, value: unknown): boolean {
  switch (key) {
    case 'portfolio_year':
      return row.portfolio_year === value;
    case 'program':
      return row.customer_id === value;
    case 'unit':
      return true;
    case 'pm_user_id':
      return row.pm_user_id === value;
    case 'stage':
      return row.stage === value;
    case 'status':
      return String(row.status ?? '').toLowerCase() === String(value).toLowerCase();
    case 'rag':
      return normalizeRag(row.rag) === normalizeRag(String(value));
    case 'type':
      return row.classification === value;
    case 'weekly_report_enabled':
      return Boolean(row.weekly_report_enabled) === Boolean(value);
    default:
      return true;
  }
}

export function applyDashboardFilters<T extends FilterableProjectRow>(
  rows: T[],
  filters: DashboardFilters,
): T[] {
  return rows.filter((row) =>
    (DASHBOARD_FILTER_KEYS as readonly DashboardFilterKey[]).every((key) => {
      if (!(key in filters)) return true;
      return matchesFilter(row, key, filters[key]);
    }),
  );
}
