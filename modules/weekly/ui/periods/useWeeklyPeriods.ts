'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { WeeklyConfig, WeeklyPeriodListItem } from '../shared/types';

export type WeeklyPeriodsError = 'unauthorized' | 'forbidden' | 'load_failed';

const DEFAULT_CONFIG: WeeklyConfig = {
  due_weekday: 5,
  due_time_utc: '18:00:00',
};

export function useWeeklyPeriods() {
  const [data, setData] = useState<WeeklyPeriodListItem[] | null>(null);
  const [config, setConfig] = useState<WeeklyConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState<WeeklyPeriodsError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [periodsRes, configRes] = await Promise.all([
        fetch('/api/weekly-periods'),
        fetch('/api/weekly-periods/config'),
      ]);

      if (periodsRes.status === 401 || configRes.status === 401) {
        setError('unauthorized');
        setData(null);
        return;
      }
      if (periodsRes.status === 403 || configRes.status === 403) {
        setError('forbidden');
        setData(null);
        return;
      }
      if (!periodsRes.ok || !configRes.ok) {
        setError('load_failed');
        setData(null);
        return;
      }

      const [periods, loadedConfig] = await Promise.all([
        periodsRes.json() as Promise<WeeklyPeriodListItem[]>,
        configRes.json() as Promise<WeeklyConfig>,
      ]);
      setData(periods);
      setConfig(loadedConfig);
      setError(null);
    } catch {
      setError('load_failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const saveConfig = useCallback(async (next: WeeklyConfig) => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/weekly-periods/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      });
      if (!res.ok) {
        toast.error("Couldn't save schedule — try again.");
        return;
      }
      setConfig(next);
      toast.success('Schedule saved');
    } catch {
      toast.error("Couldn't save schedule — try again.");
    } finally {
      setSavingConfig(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, config, loading, savingConfig, error, load, saveConfig };
}
