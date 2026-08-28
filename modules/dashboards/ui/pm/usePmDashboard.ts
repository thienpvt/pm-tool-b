'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { DashboardFilters } from '@/lib/dashboards/filters';
import type { PmDashboardPayload } from '@/modules/dashboards/ui/shared/types';

export type PmDashboardError = 'unauthorized' | 'forbidden' | 'load_failed';

export function usePmDashboard() {
  const [data, setData] = useState<PmDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<PmDashboardError | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch('/api/dashboards/pm');
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
    } catch {
      setError('load_failed');
      setData(null);
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
      const res = await fetch('/api/dashboards/pm/filters', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filters),
      });
      if (!res.ok) {
        toast.error("Couldn't save filters — try again.");
        return;
      }
      await load(true);
    },
    [load],
  );

  const clearFilters = useCallback(
    async (action: 'clear' | 'defaults') => {
      const res = await fetch('/api/dashboards/pm/filters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        toast.error("Couldn't save filters — try again.");
        return;
      }
      await load(true);
    },
    [load],
  );

  useEffect(() => {
    load(false);
  }, [load]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        load(true);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [load]);

  return { data, loading, refreshing, error, load, saveFilters, clearFilters };
}
