import { describe, expect, it } from 'vitest';
import { computePortfolioCharts, computePortfolioKpis } from './kpi';

type ProjectRow = {
  id: number;
  status: string;
  stage: string | null;
  rag: string | null;
};

describe('computePortfolioKpis active/on-track/watch (D-02, D-03)', () => {
  const projects: ProjectRow[] = [
    { id: 1, status: 'Active', stage: 'L2', rag: 'Green' },
    { id: 2, status: 'Active', stage: 'L3', rag: 'Amber' },
    { id: 3, status: 'Active', stage: 'L4', rag: 'Red' },
    { id: 4, status: 'Active', stage: 'L5', rag: 'Green' },
    { id: 5, status: 'Closed', stage: 'L2', rag: 'Green' },
    { id: 6, status: 'Active', stage: 'L1', rag: null },
    { id: 7, status: 'Active', stage: 'L0', rag: 'Not applicable' },
  ];

  it('counts active L0–L4 only; on-track Green; watch/act Amber or Red; missing rag → Amber', () => {
    const kpis = computePortfolioKpis(projects, [], [], []);
    expect(kpis.active_count).toBe(5);
    expect(kpis.on_track_count).toBe(1);
    expect(kpis.watch_act_count).toBe(4);
  });

  it('counts lowercase active status as active (DB default)', () => {
    const lowercaseActive: ProjectRow[] = [
      { id: 1, status: 'active', stage: 'L2', rag: 'Green' },
      { id: 2, status: 'Active', stage: 'L3', rag: 'Green' },
    ];
    const kpis = computePortfolioKpis(lowercaseActive, [], [], []);
    expect(kpis.active_count).toBe(2);
  });
});

describe('computePortfolioCharts stage and RAG identity (D-03, D-04)', () => {
  const projects = [
    { id: 1, status: 'Active', stage: 'L2', rag: 'Green' },
    { id: 2, status: 'Active', stage: 'L5', rag: 'Green' },
    { id: 3, status: 'Active', stage: 'L3', rag: null },
    { id: 4, status: 'Closed', stage: 'L4', rag: 'Red' },
  ];

  it('by_stage counts L5 in filtered set; by_rag ignores L5; null rag → amber; G+A+R === active', () => {
    const charts = computePortfolioCharts(projects);
    const kpis = computePortfolioKpis(projects, [], [], []);

    expect(charts.by_stage.L2).toBe(1);
    expect(charts.by_stage.L5).toBe(1);
    expect(charts.by_stage.L3).toBe(1);
    expect(charts.by_rag.green).toBe(1);
    expect(charts.by_rag.amber).toBe(1);
    expect(charts.by_rag.red).toBe(0);
    expect(charts.by_rag.green + charts.by_rag.amber + charts.by_rag.red).toBe(kpis.active_count);
    expect(kpis.active_count).toBe(2);
  });
});

describe('computePortfolioKpis drill-down counts (D-05)', () => {
  const projects = [
    { id: 10, status: 'Active', stage: 'L2', rag: 'Green' },
    { id: 11, status: 'Active', stage: 'L3', rag: 'Amber' },
  ];

  it('overdue tile is distinct project_id; high RAID is record count', () => {
    const overdueRows = [
      { project_id: 10 },
      { project_id: 10 },
      { project_id: 11 },
    ];
    const highRaid = [
      { project_id: 10 },
      { project_id: 10 },
    ];
    const techCouncil = [{ project_id: 11 }];

    const kpis = computePortfolioKpis(projects, overdueRows, highRaid, techCouncil);
    expect(kpis.overdue_milestone_project_count).toBe(2);
    expect(kpis.high_open_raid_count).toBe(2);
    expect(kpis.technology_council_count).toBe(1);
  });
});
