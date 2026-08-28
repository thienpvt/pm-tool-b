'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DashboardFilters } from '@/lib/dashboards/filters';
import type { PortfolioDashboardPayload } from '@/modules/dashboards/ui/shared/types';

export function usePortfolioSpecDashboard() {
  const [data, setData] = useState<PortfolioDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
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
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  const saveFilters = useCallback(
    async (filters: DashboardFilters) => {
      const res = await fetch('/api/dashboards/portfolio/filters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      if (!res.ok) return;
      await load(true);
    },
    [load],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  return { data, loading, refreshing, error, load, saveFilters };
}
