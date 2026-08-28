'use client';

import { Card } from '@/components/ui/card';
import type { PortfolioCharts as PortfolioChartsData } from '@/modules/dashboards/ui/shared/types';

const STAGE_ORDER = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'] as const;

const RAG_ROWS = [
  { key: 'green' as const, label: 'Green', barClass: 'bg-green-100' },
  { key: 'amber' as const, label: 'Amber', barClass: 'bg-amber-100' },
  { key: 'red' as const, label: 'Red', barClass: 'bg-red-100' },
];

type Props = {
  charts: PortfolioChartsData;
};

function BarRow({
  label,
  count,
  maxCount,
  barClass,
  testId,
}: {
  label: string;
  count: number;
  maxCount: number;
  barClass: string;
  testId?: string;
}) {
  const widthPct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs w-12 shrink-0">{label}</span>
      <div className="flex-1 h-2 bg-slate-100 rounded overflow-hidden">
        <div
          data-testid={testId}
          className={`h-2 rounded ${barClass}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="text-xs w-6 text-right shrink-0">{count}</span>
    </div>
  );
}

export function PortfolioCharts({ charts }: Props) {
  const stageCounts = STAGE_ORDER.map((stage) => charts.by_stage[stage] ?? 0);
  const stageMax = Math.max(...stageCounts, 1);

  const ragCounts = RAG_ROWS.map(({ key }) => charts.by_rag[key] ?? 0);
  const ragMax = Math.max(...ragCounts, 1);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      <Card size="sm" className="p-4">
        <h2 className="text-base font-semibold mb-3">By stage</h2>
        <div className="flex flex-col gap-2">
          {STAGE_ORDER.map((stage, i) => (
            <BarRow
              key={stage}
              label={stage}
              count={stageCounts[i]}
              maxCount={stageMax}
              barClass="bg-blue-200"
              testId={`stage-bar-${stage}`}
            />
          ))}
        </div>
      </Card>
      <Card size="sm" className="p-4">
        <h2 className="text-base font-semibold mb-3">By RAG</h2>
        <div className="flex flex-col gap-2">
          {RAG_ROWS.map(({ key, label, barClass }, i) => (
            <BarRow
              key={key}
              label={label}
              count={ragCounts[i]}
              maxCount={ragMax}
              barClass={barClass}
              testId={`rag-bar-${key}`}
            />
          ))}
        </div>
      </Card>
    </div>
  );
}
