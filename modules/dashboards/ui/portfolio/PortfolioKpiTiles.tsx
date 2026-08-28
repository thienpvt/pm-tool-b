'use client';

import { Card } from '@/components/ui/card';
import type { PortfolioKpis } from '@/modules/dashboards/ui/shared/types';

export type PortfolioDrilldownKey = 'overdue_milestones' | 'high_raid' | 'technology_council';

const KPI_TILES = [
  { label: 'Active projects', field: 'active_count' as const, drilldownKey: null, clickable: false },
  { label: 'On track', field: 'on_track_count' as const, drilldownKey: null, clickable: false },
  { label: 'Watch / act', field: 'watch_act_count' as const, drilldownKey: null, clickable: false },
  {
    label: 'Overdue milestones',
    field: 'overdue_milestone_project_count' as const,
    drilldownKey: 'overdue_milestones' as const,
    clickable: true,
  },
  {
    label: 'High open RAID',
    field: 'high_open_raid_count' as const,
    drilldownKey: 'high_raid' as const,
    clickable: true,
  },
  {
    label: 'Technology council',
    field: 'technology_council_count' as const,
    drilldownKey: 'technology_council' as const,
    clickable: true,
  },
];

type Props = {
  kpis: PortfolioKpis;
  activeKey: PortfolioDrilldownKey | null;
  onSelect: (key: PortfolioDrilldownKey | null) => void;
};

export function PortfolioKpiTiles({ kpis, activeKey, onSelect }: Props) {
  return (
    <div
      data-testid="spec-kpi-row"
      className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4"
    >
      {KPI_TILES.map(({ label, field, drilldownKey, clickable }) => {
        const count = kpis[field];
        const selected = drilldownKey !== null && activeKey === drilldownKey;
        const content = (
          <>
            <p className="text-xs font-semibold text-slate-600 truncate" title={label}>
              {label}
            </p>
            <p className="text-3xl font-semibold">{count}</p>
            {!clickable && count !== 1 && (
              <p className="text-xs text-muted-foreground">
                {count} {count === 1 ? 'project' : 'projects'}
              </p>
            )}
          </>
        );

        if (!clickable || !drilldownKey) {
          return (
            <Card key={field} size="sm" className="shadow-sm min-h-[72px] px-3 py-3">
              {content}
            </Card>
          );
        }

        return (
          <Card
            key={field}
            size="sm"
            role="button"
            aria-pressed={selected}
            aria-label={label}
            className={`shadow-sm min-h-[72px] px-3 py-3 cursor-pointer hover:bg-slate-50 ${
              selected ? 'ring-2 ring-blue-600' : ''
            }`}
            onClick={() => onSelect(selected ? null : drilldownKey)}
          >
            {content}
          </Card>
        );
      })}
    </div>
  );
}
