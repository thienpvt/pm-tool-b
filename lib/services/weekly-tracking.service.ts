import {
  getLatestVersionSnapshot,
  getWeeklyPeriodByCompany,
  listPeriodShellsRepo,
  type PeriodShellListRow,
} from '@/lib/repositories/weekly-reports.repo';
import { listTechnologyCouncilIssues } from '@/lib/repositories/issues.repo';
import { assertCompanyWrite, type AccessActor } from './access';
import { isWeeklyReportOverdue } from './weekly-reports.service';
import { ForbiddenError, NotFoundError, SubmitValidationError } from './errors';

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

function buildCounts(rows: PeriodTrackingRow[]): PeriodTrackingCounts {
  return {
    obligated: rows.length,
    not_submitted: rows.filter((r) => r.status === 'not_submitted').length,
    draft: rows.filter((r) => r.status === 'draft').length,
    submitted: rows.filter((r) => r.status === 'submitted').length,
    overdue: rows.filter((r) => r.overdue).length,
    late: rows.filter((r) => r.first_lateness === 'late').length,
  };
}

function applyTrackingFilters(
  rows: PeriodTrackingRow[],
  filters: PeriodTrackingFilters,
): PeriodTrackingRow[] {
  return rows.filter((row) => {
    if (filters.status !== undefined) {
      if (filters.status === 'overdue') {
        if (!row.overdue) return false;
      } else if (row.status !== filters.status) {
        return false;
      }
    }
    if (filters.lateness !== undefined && row.first_lateness !== filters.lateness) {
      return false;
    }
    if (filters.pm_user_id !== undefined && row.pm_user_id !== filters.pm_user_id) {
      return false;
    }
    if (filters.stage !== undefined && row.stage !== filters.stage) {
      return false;
    }
    if (filters.rag !== undefined && row.rag !== filters.rag) {
      return false;
    }
    if (filters.technology_council === true && !row.has_technology_council_issues) {
      return false;
    }
    return true;
  });
}

export async function getPeriodTracking(
  companyId: number,
  periodId: number,
  actor: AccessActor,
  filters: PeriodTrackingFilters = {},
) {
  assertCompanyWrite(actor);
  if (actor.company_id !== companyId) throw new ForbiddenError();

  const period = await getWeeklyPeriodByCompany(companyId, periodId);
  if (!period) throw new NotFoundError('Not found', 'weekly_period');

  const shells = await listPeriodShellsRepo(companyId, periodId);
  const now = new Date();
  const councilIssues = await listTechnologyCouncilIssues(companyId);
  const councilProjectIds = new Set(councilIssues.map((i) => Number(i.project_id)));

  const allRows: PeriodTrackingRow[] = shells.map((shell) => ({
    project_id: shell.project_id,
    report_id: shell.report_id,
    name: shell.name,
    project_code: shell.project_code,
    stage: shell.stage,
    status: shell.status,
    overdue: isWeeklyReportOverdue(shell.status, shell.due_at, now),
    rag: shell.rag,
    first_lateness: shell.first_lateness,
    latest_version: shell.latest_version,
    pm_user_id: shell.pm_user_id,
    pm_display_name: shell.pm_display_name,
    has_technology_council_issues: councilProjectIds.has(shell.project_id),
  }));

  const counts = buildCounts(allRows);
  const rows = applyTrackingFilters(allRows, filters);

  return {
    period: {
      id: period.id,
      display_name: period.display_name,
      iso_week: period.iso_week,
      due_at: period.due_at,
      start_date: period.start_date,
      end_date: period.end_date,
    },
    counts,
    rows,
  };
}

export function assertExportEligible(
  shellsByProjectId: Map<number, PeriodShellListRow>,
  projectIds: number[],
): void {
  const ineligible: string[] = [];
  for (const projectId of projectIds) {
    const shell = shellsByProjectId.get(projectId);
    if (!shell || shell.status !== 'submitted' || shell.latest_version < 1) {
      ineligible.push(String(projectId));
    }
  }
  if (ineligible.length > 0) {
    throw new SubmitValidationError('Projects not eligible for export', ineligible);
  }
}

export async function previewConsolidatedExport(
  companyId: number,
  periodId: number,
  actor: AccessActor,
  projectIds: number[],
) {
  assertCompanyWrite(actor);
  if (actor.company_id !== companyId) throw new ForbiddenError();

  const period = await getWeeklyPeriodByCompany(companyId, periodId);
  if (!period) throw new NotFoundError('Not found', 'weekly_period');

  const shells = await listPeriodShellsRepo(companyId, periodId);
  const shellMap = new Map(shells.map((shell) => [shell.project_id, shell]));
  assertExportEligible(shellMap, projectIds);

  const sections = await Promise.all(
    projectIds.map(async (projectId) => {
      const shell = shellMap.get(projectId)!;
      await getLatestVersionSnapshot(shell.report_id, shell.latest_version);
      return {
        project_id: shell.project_id,
        report_id: shell.report_id,
        latest_version: shell.latest_version,
        project_code: shell.project_code,
        name: shell.name,
        pm_display_name: shell.pm_display_name,
        stage: shell.stage,
        prev_week_rag: null as string | null,
        this_week_rag: null as string | null,
        progress_pct: null as number | null,
        highlights: null as string | null,
        next_week_goals: null as string | null,
        nearest_milestone: null as string | null,
        raid_counts: { risks: 0, issues: 0 },
        tech_issue_counts: 0,
      };
    }),
  );

  return {
    period: {
      id: period.id,
      display_name: period.display_name,
      iso_week: period.iso_week,
      due_at: period.due_at,
      start_date: period.start_date,
      end_date: period.end_date,
    },
    sections,
  };
}
