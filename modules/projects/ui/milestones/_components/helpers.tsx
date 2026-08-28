import type { Milestone } from '../types';

export const STATUS_COLOR: Record<string, string> = {
  'New':                'bg-slate-100 text-slate-500',
  'To Do':              'bg-slate-100 text-slate-500',
  'To-do':              'bg-slate-100 text-slate-600',
  'REFINEMENT':         'bg-slate-100 text-slate-500',
  'In Dev':             'bg-blue-100 text-blue-700',
  'In development':     'bg-blue-100 text-blue-700',
  'Ready For Dev':      'bg-sky-100 text-sky-700',
  'In Progress':        'bg-blue-100 text-blue-700',
  'In Review':          'bg-violet-100 text-violet-700',
  'PENDING':            'bg-purple-100 text-purple-700',
  'In Testing':         'bg-amber-100 text-amber-700',
  'Testing':            'bg-amber-100 text-amber-700',
  'Ready for Test':     'bg-amber-100 text-amber-700',
  'READY4TEST':         'bg-amber-100 text-amber-700',
  'STAGING-READY4TEST': 'bg-amber-100 text-amber-800',
  'Re-Open':            'bg-orange-100 text-orange-700',
  'Done':               'bg-green-100 text-green-700',
  'UAT':                'bg-emerald-100 text-emerald-700',
  'Deployed':           'bg-teal-100 text-teal-700',
  'QC Done':            'bg-green-100 text-green-700',
  'READY TO RELEASE':   'bg-teal-100 text-teal-800',
  'READY FOR RELEASE':  'bg-teal-100 text-teal-800',
  'Passed QC':          'bg-green-100 text-green-800',
  'ANBM':               'bg-green-100 text-green-700',
  'Blocked':            'bg-red-100 text-red-700',
  'Deferred':           'bg-orange-100 text-orange-700',
};

export const PRIORITY_COLOR: Record<string, string> = {
  'Blocker':  'bg-purple-100 text-purple-700 border-purple-200',
  'Critical': 'bg-red-100 text-red-700 border-red-200',
  'Major':    'bg-orange-100 text-orange-700 border-orange-200',
  'Medium':   'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Minor':    'bg-blue-100 text-blue-700 border-blue-200',
  'Trivial':  'bg-slate-100 text-slate-500 border-slate-200',
};

export const PRIORITIES = ['Blocker', 'Critical', 'Major', 'Medium', 'Minor', 'Trivial'];

export const STATUSES = [
  'New', 'To Do', 'To-do', 'REFINEMENT',
  'In Dev', 'In development', 'Ready For Dev', 'In Progress',
  'In Review', 'PENDING',
  'In Testing', 'Testing', 'Ready for Test', 'READY4TEST', 'STAGING-READY4TEST',
  'Re-Open',
  'Done', 'UAT', 'Deployed', 'QC Done', 'READY TO RELEASE', 'READY FOR RELEASE', 'Passed QC', 'ANBM',
  'Blocked', 'Deferred',
];

export const DONE_STATUSES = new Set(['Done', 'UAT', 'Deployed', 'QC Done', 'READY TO RELEASE', 'READY FOR RELEASE', 'Passed QC', 'ANBM']);
export const NOT_STARTED_STATUSES = new Set(['New', 'To Do', 'To-do', 'REFINEMENT']);
export const EXEMPT_LAG_STATUSES  = new Set(['Blocked', 'Deferred']);

export const PROJECT_STATUS_COLOR: Record<string, string> = {
  'Initiation': 'bg-blue-50 border-blue-200 text-blue-700',
  'Planning':   'bg-violet-50 border-violet-200 text-violet-700',
  'Execution':  'bg-green-50 border-green-200 text-green-700',
  'Closing':    'bg-orange-50 border-orange-200 text-orange-700',
  'On Hold':    'bg-yellow-50 border-yellow-200 text-yellow-700',
  'Completed':  'bg-emerald-50 border-emerald-200 text-emerald-700',
  'Cancelled':  'bg-red-50 border-red-200 text-red-700',
};

export const DELAY_OWNER_COLOR: Record<string, string> = {
  'Client':   'bg-purple-100 text-purple-700',
  'Vendor':   'bg-blue-100 text-blue-700',
  'Both':     'bg-orange-100 text-orange-700',
  'External': 'bg-slate-100 text-slate-600',
  'N/A':      '',
};

export const DELAY_OWNERS = ['N/A', 'Client', 'Vendor', 'Both', 'External'];

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
  const cls = lag <= 3 ? 'bg-yellow-100 text-yellow-700' : lag <= 14 ? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700';
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>+{lag}d</span>;
}

export function statusColor(s: string) { return STATUS_COLOR[s] ?? 'bg-slate-100 text-slate-500'; }

export function fmt(d: string | null | undefined) {
  if (!d) return '—';
  const [y, m, day] = d.split('-');
  return `${day}/${m}/${y}`;
}

export function blank(): Omit<Milestone, 'id' | 'project_id' | 'created_at'> {
  return { name: '', start_date: '', end_date: '' };
}
