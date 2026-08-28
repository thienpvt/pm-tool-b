import { isActiveProject, normalizeRag } from './rag';

export type PortfolioProjectRow = {
  id: number;
  status: string;
  stage: string | null | undefined;
  rag: string | null | undefined;
};

export type PortfolioKpis = {
  active_count: number;
  on_track_count: number;
  watch_act_count: number;
  overdue_milestone_project_count: number;
  high_open_raid_count: number;
  technology_council_count: number;
};

export type PortfolioCharts = {
  by_stage: Record<string, number>;
  by_rag: { green: number; amber: number; red: number };
};

const STAGE_BUCKETS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'] as const;

export function computePortfolioKpis(
  filteredProjects: PortfolioProjectRow[],
  overdueRows: { project_id: number }[],
  highRaidRecords: unknown[],
  techCouncilRows: unknown[],
): PortfolioKpis {
  const active = filteredProjects.filter(isActiveProject);
  let onTrack = 0;
  let watchAct = 0;
  for (const p of active) {
    const rag = normalizeRag(p.rag);
    if (rag === 'green') onTrack += 1;
    else watchAct += 1;
  }

  const filteredIds = new Set(filteredProjects.map((p) => p.id));
  const overdueProjectIds = new Set(
    overdueRows.filter((r) => filteredIds.has(r.project_id)).map((r) => r.project_id),
  );

  return {
    active_count: active.length,
    on_track_count: onTrack,
    watch_act_count: watchAct,
    overdue_milestone_project_count: overdueProjectIds.size,
    high_open_raid_count: highRaidRecords.length,
    technology_council_count: techCouncilRows.length,
  };
}

export function computePortfolioCharts(filteredProjects: PortfolioProjectRow[]): PortfolioCharts {
  const by_stage: Record<string, number> = {};
  for (const stage of STAGE_BUCKETS) by_stage[stage] = 0;

  for (const p of filteredProjects) {
    if (p.stage && STAGE_BUCKETS.includes(p.stage as (typeof STAGE_BUCKETS)[number])) {
      by_stage[p.stage] += 1;
    }
  }

  const by_rag = { green: 0, amber: 0, red: 0 };
  for (const p of filteredProjects.filter(isActiveProject)) {
    by_rag[normalizeRag(p.rag)] += 1;
  }

  return { by_stage, by_rag };
}
