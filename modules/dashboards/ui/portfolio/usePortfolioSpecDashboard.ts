'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { PORTFOLIO_EXPORT_FILENAME } from '@/lib/export/dashboard-portfolio';
import type { DashboardFilters } from '@/lib/dashboards/filters';
import { downloadBlob } from '@/modules/dashboards/ui/shared/downloadBlob';
import type { PortfolioDashboardPayload } from '@/modules/dashboards/ui/shared/types';

export type PortfolioDashboardError = 'unauthorized' | 'forbidden' | 'load_failed';

export function usePortfolioSpecDashboard() {
  const [data, setData] = useState<PortfolioDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<PortfolioDashboardError | null>(null);

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
      const res = await fetch('/api/dashboards/portfolio/filters', {
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
      const res = await fetch('/api/dashboards/portfolio/filters', {
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

  const exportDashboard = useCallback(async (format: 'xlsx' | 'pdf') => {
    setExporting(true);
    try {
      const res = await fetch('/api/dashboards/portfolio/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      });
      if (!res.ok) {
        toast.error('Export failed — try again.');
        return;
      }
      const blob = await res.blob();
      downloadBlob(blob, PORTFOLIO_EXPORT_FILENAME[format]);
      toast.success('Export downloaded');
    } catch {
      toast.error('Export failed — try again.');
    } finally {
      setExporting(false);
    }
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  return { data, loading, refreshing, exporting, error, load, saveFilters, clearFilters, exportDashboard };
}
