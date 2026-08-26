import { applyDashboardFilters, parseDashboardFilters, type DashboardFilters } from '@/lib/dashboards/filters';
import { resolveCurrentPeriod, isDueInUpcomingOrOverdue } from '@/lib/dashboards/period-resolver';
import { computePortfolioCharts, computePortfolioKpis } from '@/lib/dashboards/kpi';
import {
  generatePortfolioDashboardPdf,
  generatePortfolioDashboardXlsx,
  PORTFOLIO_EXPORT_CONTENT_TYPE,
  PORTFOLIO_EXPORT_FILENAME,
} from '@/lib/export/dashboard-portfolio';
import { getActivePrimaryAssignment } from '@/lib/repositories/pm-assignments.repo';
import {
  getDashboardFilters,
  upsertDashboardFilters,
} from '@/lib/repositories/dashboard-filter-state.repo';
import { listProjects } from '@/lib/repositories/projects.repo';
import { listWeeklyPeriods } from '@/lib/repositories/weekly-periods.repo';
import { listPeriodShellsRepo } from '@/lib/repositories/weekly-reports.repo';
import {
  listHighOpenRaid,
  listOverdueMilestones,
  listTechnologyCouncilIssues,
  listUpcomingMilestones,
} from '@/lib/services/raid-masters.service';
import { isWeeklyReportOverdue } from '@/lib/services/weekly-reports.service';
import { assertCompanyWrite, hasRole, type AccessActor } from './access';
import { auditLog } from './audit.service';
import { ForbiddenError } from './errors';

export type PortfolioDashboardListRow = {
  id: number;
  name: string;
  project_code: string | null;
  portfolio_year: number | null;
  customer_id: number | null;
  program_name: string | null;
  stage: string | null;
  status: string;
  rag: string | null;
  classification: string | null;
  weekly_report_enabled: boolean | null;
  progress_pct: number | null;
  pm_user_id: number | null;
  pm_name: string | null;
};

async function enrichProjectListRows(
  rawProjects: Record<string, unknown>[],
): Promise<PortfolioDashboardListRow[]> {
  const enriched: PortfolioDashboardListRow[] = [];
  for (const p of rawProjects) {
    const primary = await getActivePrimaryAssignment(Number(p.id));
    const pmUserId = primary?.user_id ?? null;
    const pmName = primary?.display_name ?? (p.pm_name as string | undefined) ?? null;
    enriched.push({
      id: Number(p.id),
      name: String(p.name ?? ''),
      project_code: (p.project_code as string | null) ?? null,
      portfolio_year: (p.portfolio_year as number | null) ?? null,
      customer_id: (p.customer_id as number | null) ?? null,
      program_name: (p.program_name as string | null) ?? null,
      stage: (p.stage as string | null) ?? null,
      status: String(p.status ?? ''),
      rag: (p.rag as string | null) ?? null,
      classification: (p.classification as string | null) ?? null,
      weekly_report_enabled: (p.weekly_report_enabled as boolean | null) ?? null,
      progress_pct: (p.progress_pct as number | null) ?? null,
      pm_user_id: pmUserId,
      pm_name: pmName,
    });
  }
  return enriched;
}

function assertPmDashboardActor(actor: AccessActor): void {
  if (actor.company_id === null) throw new ForbiddenError();
  if (!hasRole(actor, 'pm') && !hasRole(actor, 'cpmo')) throw new ForbiddenError();
}

async function buildPortfolioDashboard(actor: AccessActor, filters: DashboardFilters) {
  const rawProjects = await listProjects(actor.company_id!);
  const enriched = await enrichProjectListRows(rawProjects as Record<string, unknown>[]);

  const filtered = applyDashboardFilters(enriched, filters);
  const filteredIds = new Set(filtered.map((p) => p.id));

  const overdueAll = await listOverdueMilestones(actor.company_id!);
  const highRaidAll = await listHighOpenRaid(actor.company_id!);
  const techCouncilAll = await listTechnologyCouncilIssues(actor.company_id!);

  const overdueFiltered = overdueAll.filter((r: { project_id: number }) =>
    filteredIds.has(r.project_id),
  );
  const highRaidFiltered = highRaidAll.records.filter((r: { project_id: number }) =>
    filteredIds.has(r.project_id),
  );
  const techCouncilFiltered = techCouncilAll.filter((r: { project_id: number }) =>
    filteredIds.has(r.project_id),
  );

  return {
    filters,
    kpis: computePortfolioKpis(filtered, overdueFiltered, highRaidFiltered, techCouncilFiltered),
    charts: computePortfolioCharts(filtered),
    list: filtered,
    drilldowns: {
      overdue_milestones: overdueFiltered,
      high_raid: highRaidFiltered,
      technology_council: techCouncilFiltered,
    },
  };
}

export async function getPortfolioDashboard(actor: AccessActor) {
  assertCompanyWrite(actor);

  const stored = await getDashboardFilters(actor.user_id, 'portfolio');
  const filters = parseDashboardFilters(stored.filters);

  return buildPortfolioDashboard(actor, filters);
}

export async function getPortfolioDashboardFilters(actor: AccessActor) {
  assertCompanyWrite(actor);
  return getDashboardFilters(actor.user_id, 'portfolio');
}

export async function savePortfolioDashboardFilters(
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  assertCompanyWrite(actor);
  const parsed = parseDashboardFilters(body);
  await upsertDashboardFilters(actor.user_id, 'portfolio', parsed);
}

export async function clearPortfolioDashboardFilters(actor: AccessActor) {
  assertCompanyWrite(actor);
  await upsertDashboardFilters(actor.user_id, 'portfolio', {});
}

export type PortfolioExportBody = {
  format: 'xlsx' | 'pdf';
  filters?: Record<string, unknown>;
};

export async function exportPortfolioDashboard(actor: AccessActor, body: PortfolioExportBody) {
  assertCompanyWrite(actor);

  let applied: DashboardFilters;
  if (body.filters !== undefined) {
    applied = parseDashboardFilters(body.filters);
  } else {
    const stored = await getDashboardFilters(actor.user_id, 'portfolio');
    applied = parseDashboardFilters(stored.filters);
  }

  const payload = await buildPortfolioDashboard(actor, applied);

  const buffer =
    body.format === 'xlsx'
      ? await generatePortfolioDashboardXlsx(payload)
      : await generatePortfolioDashboardPdf(payload);

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'dashboard',
    entity_id: 'portfolio',
    action: 'dashboard_export',
    before: null,
    after: { format: body.format, filters: applied },
  });

  return {
    buffer,
    contentType: PORTFOLIO_EXPORT_CONTENT_TYPE[body.format],
    filename: PORTFOLIO_EXPORT_FILENAME[body.format],
  };
}

export async function getPmDashboard(actor: AccessActor) {
  assertPmDashboardActor(actor);

  const stored = await getDashboardFilters(actor.user_id, 'pm');
  const filters = parseDashboardFilters(stored.filters);

  const rawProjects = await listProjects(actor.company_id!, { pmUserId: actor.user_id });
  const enriched = await enrichProjectListRows(rawProjects as Record<string, unknown>[]);
  const filtered = applyDashboardFilters(enriched, filters);
  const assignedIds = new Set(filtered.map((p) => p.id));

  const today = new Date().toISOString().slice(0, 10);
  const periods = await listWeeklyPeriods(actor.company_id!);
  const period = resolveCurrentPeriod(periods, today);
  const now = new Date();

  const shells = period
    ? (await listPeriodShellsRepo(actor.company_id!, period.id)).filter((s) =>
        assignedIds.has(s.project_id),
      )
    : [];

  const weekly = shells
    .filter((s) => s.status === 'not_submitted' || s.status === 'draft')
    .map((s) => ({
      project_id: s.project_id,
      report_id: s.report_id,
      period_id: period!.id,
      period_display_name: period!.display_name,
      due_at: s.due_at,
      status: s.status,
      overdue: isWeeklyReportOverdue(s.status, s.due_at, now),
      href: `/projects/${s.project_id}/weekly-reports/${s.report_id}`,
    }));

  const upcomingAll = await listUpcomingMilestones(actor.company_id!);
  const overdueAll = await listOverdueMilestones(actor.company_id!);
  const milestoneById = new Map<number, Record<string, unknown>>();

  for (const row of upcomingAll as Record<string, unknown>[]) {
    if (!assignedIds.has(Number(row.project_id))) continue;
    milestoneById.set(Number(row.id), { ...row, kind: 'upcoming' as const });
  }
  for (const row of overdueAll as Record<string, unknown>[]) {
    if (!assignedIds.has(Number(row.project_id))) continue;
    milestoneById.set(Number(row.id), { ...row, kind: 'overdue' as const });
  }

  const milestones = [...milestoneById.values()].map((m) => ({
    project_id: Number(m.project_id),
    milestone_id: Number(m.id),
    name: String(m.name ?? ''),
    plan_end: (m.plan_end as string | null) ?? null,
    adjusted_end: (m.adjusted_end as string | null) ?? null,
    kind: m.kind as 'upcoming' | 'overdue',
    href: `/projects/${m.project_id}/milestones`,
  }));

  const raidAll = await listHighOpenRaid(actor.company_id!);
  const councilIds = new Set(
    (await listTechnologyCouncilIssues(actor.company_id!)).map((r: { id: number }) => r.id),
  );

  const raid = raidAll.records
    .filter(
      (r: { project_id: number; due_date: string | null }) =>
        assignedIds.has(r.project_id) && isDueInUpcomingOrOverdue(r.due_date, today),
    )
    .map((r: { project_id: number; entity_type: string; id: number; code: string; due_date: string | null }) => ({
      project_id: r.project_id,
      entity_type: r.entity_type,
      id: r.id,
      code: r.code,
      due_date: r.due_date,
      has_technology_council: r.entity_type === 'issue' && councilIds.has(r.id),
      href: `/projects/${r.project_id}/raid`,
    }));

  return {
    filters,
    projects: filtered,
    actions: {
      weekly,
      milestones,
      raid,
    },
  };
}

export async function getPmDashboardFilters(actor: AccessActor) {
  assertPmDashboardActor(actor);
  return getDashboardFilters(actor.user_id, 'pm');
}

export async function savePmDashboardFilters(
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  assertPmDashboardActor(actor);
  const parsed = parseDashboardFilters(body);
  await upsertDashboardFilters(actor.user_id, 'pm', parsed);
}

export async function clearPmDashboardFilters(actor: AccessActor) {
  assertPmDashboardActor(actor);
  await upsertDashboardFilters(actor.user_id, 'pm', {});
}
