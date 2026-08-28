'use client';

import type { PeriodTrackingCounts } from '../shared/types';

const CHIPS: { key: keyof PeriodTrackingCounts; label: string }[] = [
  { key: 'obligated', label: 'Obligated' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'draft', label: 'Draft' },
  { key: 'not_submitted', label: 'Not submitted' },
  { key: 'overdue', label: 'Overdue' },
  { key: 'late', label: 'Late' },
];

type Props = {
  counts: PeriodTrackingCounts;
};

export function TrackingCountsBar({ counts }: Props) {
  return (
    <div
      data-testid="tracking-counts-bar"
      className="flex flex-wrap gap-2 mb-4"
    >
      {CHIPS.map(({ key, label }) => (
        <div
          key={key}
          className="inline-flex items-center gap-1.5 rounded-md border bg-white px-2 py-1"
        >
          <span className="text-xs font-semibold text-slate-600">{label}</span>
          <span className="text-sm">{counts[key]}</span>
        </div>
      ))}
    </div>
  );
}
