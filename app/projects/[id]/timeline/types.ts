'use client';

export type Activity = {
  id: number; phase: string; no: string; activity: string; deliverable: string;
  sign_off_doc: string; accountable: string; responsible: string; support: string;
  plan_start: string; plan_end: string; actual_start: string; actual_end: string;
  status: string; completion_pct: number; notes: string; order_idx: number;
  delay_owner: string; delay_reason: string;
  jira_key: string; sprint: string; project_status: string;
  parent_id: number | null;
  priority: string;
};

export type TeamMember = { id: number; name: string; role: string; domain: string; };
export type Project = { id: number; name: string; status: string; current_phase: string; client: string; pm_name: string; };
export type Holiday   = { id: number; project_id: number; date: string; name: string; };
export type DateMode  = 'plan' | 'actual' | 'both';

export type ContextMenuState = {
  x: number; y: number; activity: Activity;
} | null;

export const DEFAULT_PHASES = ['Initializing', 'Architecture & Design', 'Setup & Infra', 'Development', 'Testing', 'UAT', 'Deployment', 'Closing'];
export const DELAY_OWNERS = ['N/A', 'Client', 'Vendor', 'Both', 'External'];

export const PRIORITIES = ['Blocker', 'Critical', 'Major', 'Medium', 'Minor', 'Trivial'];

export const PRIORITY_COLOR: Record<string, string> = {
  'Blocker':  'bg-purple-100 text-purple-700 border-purple-200',
  'Critical': 'bg-red-100 text-red-700 border-red-200',
  'Major':    'bg-orange-100 text-orange-700 border-orange-200',
  'Medium':   'bg-yellow-100 text-yellow-700 border-yellow-200',
  'Minor':    'bg-blue-100 text-blue-700 border-blue-200',
  'Trivial':  'bg-slate-100 text-slate-500 border-slate-200',
};

export const STATUSES = [
  'New', 'To Do', 'To-do', 'REFINEMENT',
  'In Dev', 'In development', 'Ready For Dev', 'In Progress',
  'In Review', 'PENDING',
  'In Testing', 'Testing', 'Ready for Test', 'READY4TEST', 'STAGING-READY4TEST',
  'Re-Open',
  'Done', 'UAT', 'Deployed', 'QC Done', 'READY TO RELEASE', 'READY FOR RELEASE', 'Passed QC', 'ANBM',
  'Blocked', 'Deferred',
];

export const DONE_STATUSES = new Set([
  'Done', 'UAT', 'Deployed', 'QC Done', 'READY TO RELEASE', 'READY FOR RELEASE', 'Passed QC', 'ANBM',
]);
export const NOT_STARTED_STATUSES = new Set(['New', 'To Do', 'To-do', 'REFINEMENT']);
export const EXEMPT_LAG_STATUSES  = new Set(['Blocked', 'Deferred']);

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

export const PHASE_STYLE: Record<string, { bg: string; text: string; bar: string; hex: string }> = {
  'Initializing':          { bg: 'bg-blue-50',   text: 'text-blue-900',   bar: 'bg-blue-500',   hex: '#3b82f6' },
  'Architecture & Design': { bg: 'bg-indigo-50',  text: 'text-indigo-900', bar: 'bg-indigo-500', hex: '#6366f1' },
  'Setup & Infra':         { bg: 'bg-cyan-50',    text: 'text-cyan-900',   bar: 'bg-cyan-500',   hex: '#06b6d4' },
  'Development':           { bg: 'bg-violet-50',  text: 'text-violet-900', bar: 'bg-violet-500', hex: '#8b5cf6' },
  'Testing':               { bg: 'bg-amber-50',   text: 'text-amber-900',  bar: 'bg-amber-500',  hex: '#f59e0b' },
  'UAT':                   { bg: 'bg-orange-50',  text: 'text-orange-900', bar: 'bg-orange-500', hex: '#f97316' },
  'Deployment':            { bg: 'bg-emerald-50', text: 'text-emerald-900',bar: 'bg-emerald-500',hex: '#10b981' },
  'Closing':               { bg: 'bg-slate-100',  text: 'text-slate-700',  bar: 'bg-slate-500',  hex: '#64748b' },
};

export function getPhaseStyle(phase: string) {
  return PHASE_STYLE[phase] ?? { bg: 'bg-gray-50', text: 'text-gray-800', bar: 'bg-gray-400', hex: '#9ca3af' };
}

export const PROJECT_STATUS_COLOR: Record<string, string> = {
  'Initiation': 'bg-blue-50 border-blue-200 text-blue-700',
  'Planning':   'bg-violet-50 border-violet-200 text-violet-700',
  'Execution':  'bg-green-50 border-green-200 text-green-700',
  'Closing':    'bg-orange-50 border-orange-200 text-orange-700',
  'On Hold':    'bg-yellow-50 border-yellow-200 text-yellow-700',
  'Completed':  'bg-emerald-50 border-emerald-200 text-emerald-700',
  'Cancelled':  'bg-red-50 border-red-200 text-red-700',
};
