'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WeeklyPeriodListItem } from '../shared/types';

export type WeeklyPeriodsError = 'unauthorized' | 'forbidden' | 'load_failed';

export function useWeeklyPeriods() {
  const [data, setData] = useState<WeeklyPeriodListItem[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WeeklyPeriodsError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/weekly-periods');
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
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, load };
}
