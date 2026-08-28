import type {
  PeriodTrackingCounts,
  PeriodTrackingPayload,
  PeriodTrackingRow,
  WeeklyConfig,
  WeeklyPeriodListItem,
  WeeklyReportEditorShell,
} from './types';

const basePeriodFields = {
  company_id: 1,
  start_date: '2026-09-01',
  end_date: '2026-09-07',
  due_at: '2026-09-05T18:00:00.000Z',
  config_snapshot: {
    due_weekday: 5,
    due_time_utc: '18:00:00',
    obligation_rule_version: 1,
  },
  created_by: 10,
  created_at: '2026-08-28T10:00:00.000Z',
};

export const periodsFixture: WeeklyPeriodListItem[] = [
  {
    id: 2,
    iso_week: '2026-W36',
    display_name: 'Week 36, 2026',
    ...basePeriodFields,
  },
  {
    id: 1,
    iso_week: '2026-W35',
    display_name: 'Week 35, 2026',
    ...basePeriodFields,
    start_date: '2026-08-25',
    end_date: '2026-08-31',
    due_at: '2026-08-29T18:00:00.000Z',
  },
];

export function emptyPeriodsFixture(): WeeklyPeriodListItem[] {
  return [];
}

export const configFixture: WeeklyConfig = {
  due_weekday: 5,
  due_time_utc: '18:00:00',
};

const trackingCountsFixture: PeriodTrackingCounts = {
  obligated: 3,
  not_submitted: 1,
  draft: 1,
  submitted: 1,
  overdue: 0,
  late: 0,
};

const trackingRowsFixture: PeriodTrackingRow[] = [
  {
    project_id: 101,
    report_id: 501,
    name: 'Alpha Project',
    project_code: 'A1',
    stage: 'L2',
    status: 'submitted',
    overdue: false,
    rag: 'green',
    first_lateness: null,
    latest_version: 1,
    pm_user_id: 5,
    pm_display_name: 'Jane PM',
    has_technology_council_issues: false,
  },
  {
    project_id: 102,
    report_id: 502,
    name: 'Beta Project',
    project_code: 'B2',
    stage: 'L3',
    status: 'draft',
    overdue: false,
    rag: 'amber',
    first_lateness: null,
    latest_version: 1,
    pm_user_id: 6,
    pm_display_name: 'Bob PM',
    has_technology_council_issues: false,
  },
  {
    project_id: 103,
    report_id: 503,
    name: 'Gamma Project',
    project_code: 'G3',
    stage: 'L1',
    status: 'not_submitted',
    overdue: true,
    rag: null,
    first_lateness: null,
    latest_version: 0,
    pm_user_id: 7,
    pm_display_name: 'Carol PM',
    has_technology_council_issues: true,
  },
];

export const trackingPayload: PeriodTrackingPayload = {
  period: periodsFixture[0],
  counts: trackingCountsFixture,
  rows: trackingRowsFixture,
};

export const trackingRows150: PeriodTrackingRow[] = Array.from({ length: 150 }, (_, i) => ({
  project_id: i + 1,
  report_id: 1000 + i + 1,
  name: `Project ${i + 1}`,
  project_code: `P${i + 1}`,
  stage: 'L2',
  status: 'submitted',
  overdue: false,
  rag: 'green',
  first_lateness: null,
  latest_version: 1,
  pm_user_id: 5,
  pm_display_name: 'Jane PM',
  has_technology_council_issues: false,
}));

export const reportShellFixture: WeeklyReportEditorShell = {
  id: 501,
  period_id: 2,
  project_id: 101,
  status: 'draft',
  correction_open: false,
  highlights: 'Key highlights',
  completed_work: 'Completed tasks',
  next_week_goals: 'Next goals',
  nearest_milestone: 'Gate review',
  nearest_milestone_id: 42,
  raid_dependency: 'No blockers',
  leadership_support: null,
  this_week_rag: null,
  prev_week_rag: 'Green',
  iso_week: '2026-W36',
  due_at: '2026-09-05T18:00:00.000Z',
  display_name: 'Week 36, 2026',
};
