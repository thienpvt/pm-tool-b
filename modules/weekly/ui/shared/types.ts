/** Client-safe weekly UI types — do not import lib/services or lib/repositories. */

export type WeeklyPeriodListItem = {
  id: number;
  company_id: number;
  iso_week: string;
  start_date: string;
  end_date: string;
  due_at: string;
  display_name: string;
  config_snapshot: {
    due_weekday: number;
    due_time_utc: string;
    obligation_rule_version: number;
  };
  created_by: number | null;
  created_at: string;
};

export type WeeklyConfig = {
  due_weekday: number;
  due_time_utc: string;
};

export type PeriodTrackingFilters = {
  status?: 'not_submitted' | 'draft' | 'submitted' | 'overdue';
  lateness?: 'on_time' | 'late';
  pm_user_id?: number;
  stage?: string;
  rag?: string;
  technology_council?: true;
};

export type PeriodTrackingRow = {
  project_id: number;
  report_id: number;
  name: string;
  project_code: string | null;
  stage: string | null;
  status: string;
  overdue: boolean;
  rag: string | null;
  first_lateness: string | null;
  latest_version: number;
  pm_user_id: number | null;
  pm_display_name: string | null;
  has_technology_council_issues: boolean;
};

export type PeriodTrackingCounts = {
  obligated: number;
  not_submitted: number;
  draft: number;
  submitted: number;
  overdue: number;
  late: number;
};

export type PeriodTrackingPayload = {
  period: WeeklyPeriodListItem;
  counts: PeriodTrackingCounts;
  rows: PeriodTrackingRow[];
};

export type WeeklyRag = 'Green' | 'Amber' | 'Red' | 'Not applicable';

export type WeeklyReportEditorShell = {
  id: number;
  period_id: number;
  project_id: number;
  status: string;
  correction_open: boolean;
  highlights: string | null;
  completed_work: string | null;
  next_week_goals: string | null;
  nearest_milestone: string | null;
  nearest_milestone_id: number | null;
  raid_dependency: string | null;
  leadership_support: string | null;
  this_week_rag: WeeklyRag | null;
  prev_week_rag: WeeklyRag | null;
  iso_week: string;
  due_at: string;
  display_name: string;
};
