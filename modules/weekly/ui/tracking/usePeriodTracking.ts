'use client';

import { useCallback, useState } from 'react';
import type { PeriodTrackingFilters, PeriodTrackingPayload } from '../shared/types';

export type PeriodTrackingError = 'unauthorized' | 'forbidden' | 'load_failed';

function buildTrackingUrl(periodId: number, filters?: PeriodTrackingFilters): string {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.lateness) params.set('lateness', filters.lateness);
  if (filters?.pm_user_id !== undefined) params.set('pm_user_id', String(filters.pm_user_id));
  if (filters?.stage) params.set('stage', filters.stage);
  if (filters?.rag) params.set('rag', filters.rag);
  if (filters?.technology_council === true) params.set('technology_council', 'true');
  const qs = params.toString();
  return `/api/weekly-periods/${periodId}/tracking${qs ? `?${qs}` : ''}`;
}

export function usePeriodTracking() {
  const [data, setData] = useState<PeriodTrackingPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PeriodTrackingError | null>(null);

  const load = useCallback(async (periodId: number, filters?: PeriodTrackingFilters) => {
    setLoading(true);
    try {
      const res = await fetch(buildTrackingUrl(periodId, filters));
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

  return { data, loading, error, load };
}
