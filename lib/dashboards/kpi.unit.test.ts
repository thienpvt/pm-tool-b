import { describe, expect, it } from 'vitest';
import { computePortfolioKpis } from './kpi';

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
});
