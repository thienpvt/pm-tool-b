'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ComplianceFilters, CompliancePayload } from '@/modules/documents/ui/shared/types';

export type DocumentComplianceError = 'unauthorized' | 'forbidden' | 'load_failed';

export function buildComplianceQuery(filters: ComplianceFilters): string {
  const params = new URLSearchParams();
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.status) params.set('status', filters.status);
  if (filters.rag) params.set('rag', filters.rag);
  if (filters.program !== undefined && filters.program !== '') {
    params.set('program', String(filters.program));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useDocumentCompliance() {
  const [data, setData] = useState<CompliancePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<DocumentComplianceError | null>(null);

  const load = useCallback(async (filters: ComplianceFilters = {}, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch(`/api/dashboards/document-compliance${buildComplianceQuery(filters)}`);
      if (res.status === 401) {
        setError('unauthorized');
        setData(null);
        return { ok: false as const, status: 401 };
      }
      if (res.status === 403) {
        setError('forbidden');
        setData(null);
        return { ok: false as const, status: 403 };
      }
      if (res.status === 400) {
        toast.error('Invalid filter — check your selections.');
        return { ok: false as const, status: 400 };
      }
      if (!res.ok) {
        setError('load_failed');
        setData(null);
        return { ok: false as const, status: res.status };
      }
      setData(await res.json());
      setError(null);
      return { ok: true as const, status: 200 };
    } catch {
      setError('load_failed');
      setData(null);
      return { ok: false as const, status: 0 };
    } finally {
      if (isRefresh) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load({}, false);
  }, [load]);

  return { data, loading, refreshing, error, load };
}
