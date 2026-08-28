'use client';

// NIT-04: fiscal KPIs live on /portfolio/budget, not spec tiles.

import Sidebar from '@/components/layout/Sidebar';
import { Card } from '@/components/ui/card';
import { PortfolioFiltersBar } from './PortfolioFiltersBar';
import { usePortfolioSpecDashboard } from './usePortfolioSpecDashboard';

const KPI_TILES = [
  { label: 'Active projects', field: 'active_count' as const, clickable: false },
  { label: 'On track', field: 'on_track_count' as const, clickable: false },
  { label: 'Watch / act', field: 'watch_act_count' as const, clickable: false },
  { label: 'Overdue milestones', field: 'overdue_milestone_project_count' as const, clickable: true },
  { label: 'High open RAID', field: 'high_open_raid_count' as const, clickable: true },
  { label: 'Technology council', field: 'technology_council_count' as const, clickable: true },
];

export default function PortfolioDashboardPage() {
  const { data, loading, refreshing, saveFilters, clearFilters } = usePortfolioSpecDashboard();

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
        <div
          data-testid="spec-kpi-row"
          className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4"
        >
          {KPI_TILES.map(({ label, field, clickable }) => (
            <Card
              key={field}
              size="sm"
              className={`shadow-sm min-h-[72px] px-3 py-3 ${clickable ? 'cursor-pointer hover:bg-slate-50' : ''}`}
            >
              <p
                className="text-xs font-semibold text-slate-600 truncate"
                title={label}
              >
                {label}
              </p>
              <p className="text-3xl font-semibold">{data.kpis[field]}</p>
            </Card>
          ))}
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Budget and fiscal metrics are on Portfolio Budget (/portfolio/budget).
        </p>
      </main>
    </div>
  );
}
