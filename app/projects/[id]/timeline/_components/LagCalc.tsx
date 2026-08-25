import React from 'react';
import { EXEMPT_LAG_STATUSES, DONE_STATUSES, NOT_STARTED_STATUSES } from '../types';

export function calcLag(planEnd: string, actualEnd: string, status: string): number {
  if (!planEnd) return 0;
  if (EXEMPT_LAG_STATUSES.has(status)) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const plan = new Date(planEnd); plan.setHours(0, 0, 0, 0);

  if (DONE_STATUSES.has(status)) {
    if (!actualEnd) return 0;
    const actual = new Date(actualEnd); actual.setHours(0, 0, 0, 0);
    return Math.round((actual.getTime() - plan.getTime()) / 86400000);
  }
  if (NOT_STARTED_STATUSES.has(status)) return 0;
  return today > plan ? Math.round((today.getTime() - plan.getTime()) / 86400000) : 0;
}

export function LagBadge({ lag }: { lag: number }) {
  if (lag <= 0) return <span className="text-[10px] text-green-600 font-medium">On time</span>;
  const cls = lag <= 3  ? 'bg-yellow-100 text-yellow-700'
             : lag <= 14 ? 'bg-orange-100 text-orange-700'
             : 'bg-red-100 text-red-700';
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>+{lag}d</span>;
}

export const DELAY_OWNER_COLOR: Record<string, string> = {
  'Client':   'bg-purple-100 text-purple-700',
  'Vendor':   'bg-blue-100 text-blue-700',
  'Both':     'bg-orange-100 text-orange-700',
  'External': 'bg-slate-100 text-slate-600',
  'N/A':      '',
};
