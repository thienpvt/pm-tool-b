'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import type { PeriodTrackingFilters, WeeklyPeriodListItem } from '../shared/types';
import { TrackingCountsBar } from './TrackingCountsBar';
import { TrackingFiltersBar } from './TrackingFiltersBar';
import { TrackingGrid } from './TrackingGrid';
import { usePeriodTracking } from './usePeriodTracking';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this page.",
  load_failed: "Couldn't load this page. Try again.",
} as const;

function resolvePeriodId(
  periods: WeeklyPeriodListItem[],
  queryPeriodId: string | null,
): number | null {
  if (periods.length === 0) return null;
  if (queryPeriodId) {
    const parsed = Number(queryPeriodId);
    const match = periods.find((p) => p.id === parsed);
    if (match) return match.id;
  }
  return periods[0].id;
}

function WeeklyTrackingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryPeriodId = searchParams.get('periodId');

  const [periods, setPeriods] = useState<WeeklyPeriodListItem[] | null>(null);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [periodsError, setPeriodsError] = useState<
    'unauthorized' | 'forbidden' | 'load_failed' | null
  >(null);

  const { data, loading: trackingLoading, error: trackingError, load } = usePeriodTracking();
  const [filters, setFilters] = useState<PeriodTrackingFilters>({});
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  const selectedPeriodId = useMemo(() => {
    if (!periods) return null;
    return resolvePeriodId(periods, queryPeriodId);
  }, [periods, queryPeriodId]);

  const loadPeriods = useCallback(async () => {
    setPeriodsLoading(true);
    try {
      const res = await fetch('/api/weekly-periods');
      if (res.status === 401) {
        setPeriodsError('unauthorized');
        setPeriods(null);
        return;
      }
      if (res.status === 403) {
        setPeriodsError('forbidden');
        setPeriods(null);
        return;
      }
      if (!res.ok) {
        setPeriodsError('load_failed');
        setPeriods(null);
        return;
      }
      setPeriods(await res.json());
      setPeriodsError(null);
    } catch {
      setPeriodsError('load_failed');
      setPeriods(null);
    } finally {
      setPeriodsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPeriods();
  }, [loadPeriods]);

  useEffect(() => {
    if (selectedPeriodId !== null) {
      load(selectedPeriodId, filters);
    }
  }, [selectedPeriodId, load, filters]);

  useEffect(() => {
    setSelectedIds([]);
  }, [selectedPeriodId, filters]);

  const handlePeriodChange = (value: string) => {
    setFilters({});
    router.replace(`/weekly/tracking?periodId=${value}`);
  };

  const handleApplyFilters = (next: PeriodTrackingFilters) => {
    setFilters(next);
  };

  const error = periodsError ?? trackingError;
  const loading = periodsLoading || (selectedPeriodId !== null && trackingLoading && !data);

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading tracking…</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-slate-600">{ERROR_COPY[error]}</p>
          </div>
        </main>
      </div>
    );
  }

  if (periods && periods.length === 0) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <p className="font-semibold text-slate-600">No periods to track</p>
            <p className="text-sm text-muted-foreground">
              Create a weekly period first, then return here to track submissions.
            </p>
            <Link href="/weekly/periods" className="text-blue-600 hover:underline text-sm">
              Go to Weekly periods
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!periods || selectedPeriodId === null) return null;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <h1 className="text-base font-semibold">Weekly tracking</h1>
          <select
            aria-label="Period"
            className="h-8 text-sm border border-input rounded-md px-2 bg-white min-w-[180px]"
            value={String(selectedPeriodId)}
            onChange={(e) => handlePeriodChange(e.target.value)}
          >
            {periods.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </div>

        {data && (
          <>
            <TrackingCountsBar counts={data.counts} />
            <TrackingFiltersBar
              rows={data.rows}
              disabled={trackingLoading}
              onApply={handleApplyFilters}
            />
            <TrackingGrid
              rows={data.rows}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
            />
            <span data-testid="tracking-selected-ids" className="sr-only">
              {JSON.stringify(selectedIds)}
            </span>
          </>
        )}
      </main>
    </div>
  );
}

export default function WeeklyTrackingPage() {
  return (
    <Suspense>
      <WeeklyTrackingContent />
    </Suspense>
  );
}
