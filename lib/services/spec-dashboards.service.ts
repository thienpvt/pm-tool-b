import { applyDashboardFilters, parseDashboardFilters, type DashboardFilters } from '@/lib/dashboards/filters';
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
import {
  listHighOpenRaid,
  listOverdueMilestones,
  listTechnologyCouncilIssues,
} from '@/lib/services/raid-masters.service';
import { assertCompanyWrite, type AccessActor } from './access';
import { auditLog } from './audit.service';

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

async function buildPortfolioDashboard(actor: AccessActor, filters: DashboardFilters) {
  const rawProjects = await listProjects(actor.company_id!);
  const enriched: PortfolioDashboardListRow[] = [];
  for (const p of rawProjects as Record<string, unknown>[]) {
    const primary = await getActivePrimaryAssignment(Number(p.id));
    const pmUserId = primary?.user_id ?? null;
    const pmName =
      (p.pm_name as string | undefined) ||
      (primary as { display_name?: string } | null)?.display_name ||
      null;
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
