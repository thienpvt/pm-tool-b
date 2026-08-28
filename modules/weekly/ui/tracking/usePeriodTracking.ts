'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { downloadBlob } from '@/modules/dashboards/ui/shared/downloadBlob';
import type { PeriodTrackingFilters, PeriodTrackingPayload } from '../shared/types';
import type { ExportFormat } from './ExportToolbar';

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

function parseExportFilename(contentDisposition: string | null): string {
  if (!contentDisposition) return 'weekly-export.xlsx';
  const match = contentDisposition.match(/filename="([^"]+)"/);
  return match?.[1] ?? 'weekly-export.xlsx';
}

function uniqueProjectIds(projectIds: number[]): number[] {
  const seen = new Set<number>();
  const result: number[] = [];
  for (const id of projectIds) {
    if (!seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

export function usePeriodTracking() {
  const [data, setData] = useState<PeriodTrackingPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
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

  const exportPack = useCallback(
    async (periodId: number, projectIds: number[], format: ExportFormat) => {
      setExporting(true);
      try {
        const res = await fetch(`/api/weekly-periods/${periodId}/export`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            project_ids: uniqueProjectIds(projectIds),
            format,
          }),
        });
        if (!res.ok) {
          toast.error('Export failed — try again.');
          return;
        }
        const blob = await res.blob();
        const filename = parseExportFilename(res.headers.get('Content-Disposition'));
        downloadBlob(blob, filename);
        toast.success('Export downloaded');
      } catch {
        toast.error('Export failed — try again.');
      } finally {
        setExporting(false);
      }
    },
    [],
  );

  return { data, loading, exporting, error, load, exportPack };
}
