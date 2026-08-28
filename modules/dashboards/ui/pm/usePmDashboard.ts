'use client';

import { useCallback, useEffect, useState } from 'react';
import type { PmDashboardPayload } from '@/modules/dashboards/ui/shared/types';

export type PmDashboardError = 'unauthorized' | 'forbidden' | 'load_failed';

export function usePmDashboard() {
  const [data, setData] = useState<PmDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<PmDashboardError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
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
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, load };
}
