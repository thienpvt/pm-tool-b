'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AuditFilters, AuditLogRow } from '@/modules/documents/ui/shared/types';

export type AuditLogError = 'unauthorized' | 'forbidden' | 'load_failed';

const DEFAULT_LIMIT = 50;

export function buildAuditQuery(filters: AuditFilters): string {
  const params = new URLSearchParams();
  if (filters.entity_type) params.set('entity_type', filters.entity_type);
  if (filters.entity_id) params.set('entity_id', filters.entity_id);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const limit = filters.limit ?? DEFAULT_LIMIT;
  params.set('limit', String(limit));
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function useAuditLog() {
  const [data, setData] = useState<AuditLogRow[] | null>(null);
  const [filters, setFilters] = useState<AuditFilters>({ limit: DEFAULT_LIMIT });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<AuditLogError | null>(null);
  const loadSeqRef = useRef(0);

  const load = useCallback(async (nextFilters: AuditFilters = { limit: DEFAULT_LIMIT }, isRefresh = false) => {
    const requestId = ++loadSeqRef.current;
    const applied = { limit: DEFAULT_LIMIT, ...nextFilters };
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch(`/api/audit${buildAuditQuery(applied)}`);
      if (requestId !== loadSeqRef.current) return { ok: false as const, status: 0 };
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
      if (!res.ok) {
        setError('load_failed');
        setData(null);
        return { ok: false as const, status: res.status };
      }
      const rows = (await res.json()) as AuditLogRow[];
      if (requestId !== loadSeqRef.current) return { ok: false as const, status: 0 };
      setData(rows);
      setFilters(applied);
      setError(null);
      return { ok: true as const, status: 200 };
    } catch {
      if (requestId !== loadSeqRef.current) return { ok: false as const, status: 0 };
      setError('load_failed');
      setData(null);
      return { ok: false as const, status: 0 };
    } finally {
      if (requestId === loadSeqRef.current) {
        if (isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    }
  }, []);

  useEffect(() => {
    load({ limit: DEFAULT_LIMIT }, false);
  }, [load]);

  return { data, filters, loading, refreshing, error, load };
}
