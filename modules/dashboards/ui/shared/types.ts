import type { DashboardFilters } from '@/lib/dashboards/filters';
import type { PortfolioCharts, PortfolioKpis } from '@/lib/dashboards/kpi';
import type { PortfolioDashboardListRow } from '@/lib/services/spec-dashboards.service';

export type { PortfolioCharts, PortfolioKpis, DashboardFilters, PortfolioDashboardListRow };

export type PortfolioDashboardPayload = {
  filters: DashboardFilters;
  kpis: PortfolioKpis;
  charts: PortfolioCharts;
  list: PortfolioDashboardListRow[];
  drilldowns: {
    overdue_milestones: unknown[];
    high_raid: unknown[];
    technology_council: unknown[];
  };
};

export type PmDashboardWeeklyAction = {
  project_id: number;
  report_id: number;
  period_id: number;
  period_display_name: string;
  due_at: string | null;
  status: string;
  overdue: boolean;
  href: string;
};

export type PmDashboardMilestoneAction = {
  project_id: number;
  milestone_id: number;
  name: string;
  plan_end: string | null;
  adjusted_end: string | null;
  kind: 'upcoming' | 'overdue';
  href: string;
};

export type PmDashboardRaidAction = {
  project_id: number;
  entity_type: string;
  id: number;
  code: string;
  due_date: string | null;
  has_technology_council: boolean;
  href: string;
};

export type PmDashboardPayload = {
  filters: DashboardFilters;
  projects: PortfolioDashboardListRow[];
  actions: {
    weekly: PmDashboardWeeklyAction[];
    milestones: PmDashboardMilestoneAction[];
    raid: PmDashboardRaidAction[];
  };
};
