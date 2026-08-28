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
import {
  generateConsolidatedWeekly,
  sanitizeConsolidatedFilename,
  CONTENT_TYPE_BY_FORMAT,
  type ConsolidatedExportFormat,
} from '@/lib/export/consolidated-weekly';
import { insertWeeklyExportLog } from '@/lib/repositories/weekly-export.repo';
import { auditLog } from '@/modules/audit/backend/services/audit.service';

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

export type ExportPreviewSection = {
  project_id: number;
  report_id: number;
  latest_version: number;
  project_code: string | null;
  name: string;
  pm_display_name: string | null;
  stage: string | null;
  prev_week_rag: string | null;
  this_week_rag: string | null;
  progress_pct: number | null;
  highlights: string | null;
  next_week_goals: string | null;
  nearest_milestone: string | null;
  raid_counts: { risks: number; issues: number };
  tech_issue_counts: number;
  raid: { risks: unknown[]; issues: unknown[] };
  tech_issues: unknown[];
};

function readSnapshotString(snapshot: Record<string, unknown>, key: string): string | null {
  const value = snapshot[key];
  return typeof value === 'string' ? value : null;
}

function readSnapshotNumber(snapshot: Record<string, unknown>, key: string): number | null {
  const value = snapshot[key];
  return typeof value === 'number' ? value : null;
}

function readSnapshotRaid(snapshot: Record<string, unknown>): { risks: unknown[]; issues: unknown[] } {
  const raid = snapshot.raid;
  if (!raid || typeof raid !== 'object') return { risks: [], issues: [] };
  const record = raid as Record<string, unknown>;
  return {
    risks: Array.isArray(record.risks) ? record.risks : [],
    issues: Array.isArray(record.issues) ? record.issues : [],
  };
}

function filterSnapshotTechIssues(issues: unknown[]): unknown[] {
  return issues.filter(
    (issue) =>
      issue !== null
      && typeof issue === 'object'
      && (issue as Record<string, unknown>).technology_council === true,
  );
}

export function assembleSnapshotSections(
  projectIds: number[],
  shellMap: Map<number, PeriodShellListRow>,
  snapshotByReportId: Map<number, Record<string, unknown>>,
): ExportPreviewSection[] {
  return projectIds.map((projectId) => {
    const shell = shellMap.get(projectId)!;
    const snapshot = snapshotByReportId.get(shell.report_id) ?? {};
    const { risks, issues } = readSnapshotRaid(snapshot);
    const techIssues = filterSnapshotTechIssues(issues);

    return {
      project_id: shell.project_id,
      report_id: shell.report_id,
      latest_version: shell.latest_version,
      project_code: shell.project_code,
      name: shell.name,
      pm_display_name: shell.pm_display_name,
      stage: shell.stage,
      prev_week_rag: readSnapshotString(snapshot, 'prev_week_rag'),
      this_week_rag: readSnapshotString(snapshot, 'this_week_rag'),
      progress_pct: readSnapshotNumber(snapshot, 'progress_pct'),
      highlights: readSnapshotString(snapshot, 'highlights'),
      next_week_goals: readSnapshotString(snapshot, 'next_week_goals'),
      nearest_milestone: readSnapshotString(snapshot, 'nearest_milestone'),
      raid_counts: { risks: risks.length, issues: issues.length },
      tech_issue_counts: techIssues.length,
      raid: { risks, issues },
      tech_issues: techIssues,
    };
  });
}

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

async function loadSnapshotsForProjects(
  projectIds: number[],
  shellMap: Map<number, PeriodShellListRow>,
): Promise<Map<number, Record<string, unknown>>> {
  const snapshotByReportId = new Map<number, Record<string, unknown>>();
  for (const projectId of projectIds) {
    const shell = shellMap.get(projectId)!;
    const snapshot = await getLatestVersionSnapshot(shell.report_id, shell.latest_version);
    if (!snapshot) throw new NotFoundError('Not found', 'weekly_report_version');
    snapshotByReportId.set(shell.report_id, snapshot);
  }
  return snapshotByReportId;
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

  const snapshotByReportId = await loadSnapshotsForProjects(projectIds, shellMap);
  const sections = assembleSnapshotSections(projectIds, shellMap, snapshotByReportId);

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

export type ConsolidatedExportBody = {
  project_ids: number[];
  format: ConsolidatedExportFormat;
};

export async function exportConsolidatedWeekly(
  companyId: number,
  periodId: number,
  actor: AccessActor,
  body: ConsolidatedExportBody,
) {
  assertCompanyWrite(actor);
  if (actor.company_id !== companyId) throw new ForbiddenError();

  const period = await getWeeklyPeriodByCompany(companyId, periodId);
  if (!period) throw new NotFoundError('Not found', 'weekly_period');

  const shells = await listPeriodShellsRepo(companyId, periodId);
  const shellMap = new Map(shells.map((shell) => [shell.project_id, shell]));
  assertExportEligible(shellMap, body.project_ids);

  const snapshotByReportId = await loadSnapshotsForProjects(body.project_ids, shellMap);
  const sections = assembleSnapshotSections(body.project_ids, shellMap, snapshotByReportId);
  const dataVersion = Math.max(
    ...body.project_ids.map((projectId) => shellMap.get(projectId)!.latest_version),
  );

  const buffer = await generateConsolidatedWeekly(
    {
      period: {
        id: period.id,
        display_name: period.display_name,
        iso_week: period.iso_week,
        due_at: period.due_at,
      },
      data_version: dataVersion,
      sections,
    },
    body.format,
  );

  await insertWeeklyExportLog({
    period_id: periodId,
    company_id: companyId,
    exported_by: actor.user_id,
    format: body.format,
    data_version: dataVersion,
    project_ids: body.project_ids,
    period_display_name: period.display_name,
  });

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'weekly_period',
    entity_id: String(periodId),
    action: 'weekly_export',
    before: null,
    after: { format: body.format, data_version: dataVersion, project_ids: body.project_ids },
  });

  return {
    buffer,
    filename: sanitizeConsolidatedFilename(period.display_name, body.format),
    contentType: CONTENT_TYPE_BY_FORMAT[body.format],
  };
}
