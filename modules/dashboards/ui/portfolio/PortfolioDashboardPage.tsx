'use client';

// NIT-04: fiscal KPIs live on /portfolio/budget, not spec tiles.

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PortfolioCharts } from './PortfolioCharts';
import { PortfolioDrilldownTable } from './PortfolioDrilldownTable';
import { PortfolioFiltersBar } from './PortfolioFiltersBar';
import { PortfolioKpiTiles, type PortfolioDrilldownKey } from './PortfolioKpiTiles';
import { PortfolioProjectTable } from './PortfolioProjectTable';
import { usePortfolioSpecDashboard } from './usePortfolioSpecDashboard';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this dashboard.",
  load_failed: "Couldn't load the dashboard. Try again.",
} as const;

export default function PortfolioDashboardPage() {
  const { data, loading, refreshing, exporting, error, saveFilters, clearFilters, exportDashboard } =
    usePortfolioSpecDashboard();
  const [activeKey, setActiveKey] = useState<PortfolioDrilldownKey | null>(null);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-slate-400 text-sm">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <AlertTriangle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-slate-600">{ERROR_COPY[error]}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-base font-semibold">Spec dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data.list.length} project{data.list.length === 1 ? '' : 's'} matching filters
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            className="bg-blue-600 text-white hover:bg-blue-700"
            disabled={exporting}
            onClick={() => exportDashboard('xlsx')}
          >
            {exporting ? 'Exporting…' : 'Export Excel'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={exporting}
            onClick={() => exportDashboard('pdf')}
          >
            Export PDF
          </Button>
        </div>
      </div>
      <PortfolioFiltersBar
        filters={data.filters}
        list={data.list}
        refreshing={refreshing}
        onApply={saveFilters}
        onClear={() => clearFilters('clear')}
        onReset={() => clearFilters('defaults')}
      />
      <PortfolioKpiTiles
        kpis={data.kpis}
        activeKey={activeKey}
        onSelect={setActiveKey}
      />
      <PortfolioCharts charts={data.charts} />
      <PortfolioProjectTable list={data.list} />
      <PortfolioDrilldownTable activeKey={activeKey} drilldowns={data.drilldowns} />
      <p className="mt-4 text-xs text-muted-foreground">
        Budget and fiscal metrics are on Portfolio Budget (/portfolio/budget).
      </p>
    </>
  );
}
