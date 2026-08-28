'use client';

// NIT-04: fiscal KPIs live on /portfolio/budget, not spec tiles.

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { PortfolioCharts } from './PortfolioCharts';
import { PortfolioDrilldownTable } from './PortfolioDrilldownTable';
import { PortfolioFiltersBar } from './PortfolioFiltersBar';
import { PortfolioKpiTiles, type PortfolioDrilldownKey } from './PortfolioKpiTiles';
import { usePortfolioSpecDashboard } from './usePortfolioSpecDashboard';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this dashboard.",
  load_failed: "Couldn't load the dashboard. Try again.",
} as const;

export default function PortfolioDashboardPage() {
  const { data, loading, refreshing, error, saveFilters, clearFilters } = usePortfolioSpecDashboard();
  const [activeKey, setActiveKey] = useState<PortfolioDrilldownKey | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading dashboard…</p>
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

  if (!data) return null;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
        <h1 className="text-base font-semibold mb-4">Spec dashboard</h1>
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
        <PortfolioDrilldownTable activeKey={activeKey} drilldowns={data.drilldowns} />
        <p className="mt-4 text-xs text-muted-foreground">
          Budget and fiscal metrics are on Portfolio Budget (/portfolio/budget).
        </p>
      </main>
    </div>
  );
}
