'use client';

import { useCallback, useEffect, useState } from 'react';

export type PortfolioDashboardData = {
  filters: Record<string, unknown>;
  kpis: {
    active_count: number;
    on_track_count: number;
    watch_act_count: number;
    overdue_milestone_project_count: number;
    high_open_raid_count: number;
    technology_council_count: number;
  };
  charts: {
    by_stage: Record<string, number>;
    by_rag: { green: number; amber: number; red: number };
  };
  list: unknown[];
  drilldowns: {
    overdue_milestones: unknown[];
    high_raid: unknown[];
    technology_council: unknown[];
  };
};

export function usePortfolioSpecDashboard() {
  const [data, setData] = useState<PortfolioDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboards/portfolio');
      if (res.status === 401) {
        setError('unauthorized');
        setData(null);
        return;
      }
      if (res.status === 403) {
        setError('forbidden');
        setData(null);
        return;
      }
      if (!res.ok) {
        setError('load_failed');
        setData(null);
        return;
      }
      setData(await res.json());
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, load };
}
