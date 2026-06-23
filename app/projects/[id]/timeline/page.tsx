'use client';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Download, Upload, FileDown, AlertCircle, GanttChart, LayoutList, CalendarX2, ChevronDown, ChevronRight, ChevronsUpDown, X, Tag, Copy, Eye, FolderPlus, RefreshCw } from 'lucide-react';
import ImportMappingDialog from '@/components/timeline/ImportMappingDialog';
import JiraSyncDialog from '@/components/jira/JiraSyncDialog';
import { statusPct, weightedProgress } from '@/lib/status-weights';

type Activity = {
  id: number; phase: string; no: string; activity: string; deliverable: string;
  sign_off_doc: string; accountable: string; responsible: string; support: string;
  plan_start: string; plan_end: string; actual_start: string; actual_end: string;
  status: string; completion_pct: number; notes: string; order_idx: number;
  delay_owner: string; delay_reason: string;
  jira_key: string; sprint: string; project_status: string;
  parent_id: number | null;
};

type TeamMember = { id: number; name: string; role: string; domain: string; };
type Project = { id: number; name: string; status: string; current_phase: string; client: string; pm_name: string; };
type Holiday   = { id: number; project_id: number; date: string; name: string; };
type DateMode  = 'plan' | 'actual' | 'both';

type ContextMenuState = {
  x: number; y: number; activity: Activity;
} | null;

const DEFAULT_PHASES = ['Initializing', 'Architecture & Design', 'Setup & Infra', 'Development', 'Testing', 'UAT', 'Deployment', 'Closing'];
const DELAY_OWNERS = ['N/A', 'Client', 'Vendor', 'Both', 'External'];

const STATUSES = [
  'New', 'To Do', 'To-do', 'REFINEMENT',
  'In Dev', 'In development', 'Ready For Dev', 'In Progress',
  'In Review', 'PENDING',
  'In Testing', 'Testing', 'Ready for Test', 'READY4TEST', 'STAGING-READY4TEST',
  'Re-Open',
  'Done', 'UAT', 'Deployed', 'QC Done', 'READY TO RELEASE', 'READY FOR RELEASE', 'Passed QC', 'ANBM',
  'Blocked', 'Deferred',
];

const DONE_STATUSES = new Set([
  'Done', 'UAT', 'Deployed', 'QC Done', 'READY TO RELEASE', 'READY FOR RELEASE', 'Passed QC', 'ANBM',
]);
const NOT_STARTED_STATUSES = new Set(['New', 'To Do', 'To-do', 'REFINEMENT']);
const EXEMPT_LAG_STATUSES  = new Set(['Blocked', 'Deferred']);

const STATUS_COLOR: Record<string, string> = {
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

const PHASE_STYLE: Record<string, { bg: string; text: string; bar: string; hex: string }> = {
  'Initializing':          { bg: 'bg-blue-50',   text: 'text-blue-900',   bar: 'bg-blue-500',   hex: '#3b82f6' },
  'Architecture & Design': { bg: 'bg-indigo-50',  text: 'text-indigo-900', bar: 'bg-indigo-500', hex: '#6366f1' },
  'Setup & Infra':         { bg: 'bg-cyan-50',    text: 'text-cyan-900',   bar: 'bg-cyan-500',   hex: '#06b6d4' },
  'Development':           { bg: 'bg-violet-50',  text: 'text-violet-900', bar: 'bg-violet-500', hex: '#8b5cf6' },
  'Testing':               { bg: 'bg-amber-50',   text: 'text-amber-900',  bar: 'bg-amber-500',  hex: '#f59e0b' },
  'UAT':                   { bg: 'bg-orange-50',  text: 'text-orange-900', bar: 'bg-orange-500', hex: '#f97316' },
  'Deployment':            { bg: 'bg-emerald-50', text: 'text-emerald-900',bar: 'bg-emerald-500',hex: '#10b981' },
  'Closing':               { bg: 'bg-slate-100',  text: 'text-slate-700',  bar: 'bg-slate-500',  hex: '#64748b' },
};

function getPhaseStyle(phase: string) {
  return PHASE_STYLE[phase] ?? { bg: 'bg-gray-50', text: 'text-gray-800', bar: 'bg-gray-400', hex: '#9ca3af' };
}

const PROJECT_STATUS_COLOR: Record<string, string> = {
  'Initiation': 'bg-blue-50 border-blue-200 text-blue-700',
  'Planning':   'bg-violet-50 border-violet-200 text-violet-700',
  'Execution':  'bg-green-50 border-green-200 text-green-700',
  'Closing':    'bg-orange-50 border-orange-200 text-orange-700',
  'On Hold':    'bg-yellow-50 border-yellow-200 text-yellow-700',
  'Completed':  'bg-emerald-50 border-emerald-200 text-emerald-700',
  'Cancelled':  'bg-red-50 border-red-200 text-red-700',
};

// ─── Lag calculation ──────────────────────────────────────────────────────────
function calcLag(planEnd: string, actualEnd: string, status: string): number {
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

function LagBadge({ lag }: { lag: number }) {
  if (lag <= 0) return <span className="text-[10px] text-green-600 font-medium">On time</span>;
  const cls = lag <= 3  ? 'bg-yellow-100 text-yellow-700'
             : lag <= 14 ? 'bg-orange-100 text-orange-700'
             : 'bg-red-100 text-red-700';
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cls}`}>+{lag}d</span>;
}

const DELAY_OWNER_COLOR: Record<string, string> = {
  'Client':   'bg-purple-100 text-purple-700',
  'Vendor':   'bg-blue-100 text-blue-700',
  'Both':     'bg-orange-100 text-orange-700',
  'External': 'bg-slate-100 text-slate-600',
  'N/A':      '',
};

// ─── CSV helpers ──────────────────────────────────────────────────────────────
const CSV_HEADERS = [
  'No', 'Phase', 'Key', 'Activity', 'Deliverable', 'Sign-off Document',
  'Accountable', 'Responsible', 'Support',
  'Plan Start', 'Plan End', 'Actual Start', 'Actual End',
  'Status', 'Completion (%)', 'Sprint', 'Delay Owner', 'Delay Reason', 'Notes',
];

function escapeCSV(val: string | number | null | undefined): string {
  const s = String(val ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
}

function activitiesToCSV(rows: Activity[]): string {
  const lines = [CSV_HEADERS.join(',')];
  for (const r of rows) {
    lines.push([
      r.no, r.phase, r.jira_key, r.activity, r.deliverable, r.sign_off_doc,
      r.accountable, r.responsible, r.support,
      r.plan_start, r.plan_end, r.actual_start, r.actual_end,
      r.status, r.completion_pct, r.sprint, r.delay_owner, r.delay_reason, r.notes,
    ].map(escapeCSV).join(','));
  }
  return lines.join('\r\n');
}

function downloadCSV(content: string, filename: string) {
  const bom = '﻿';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const TEMPLATE_ROWS = [
  ['1', 'Initializing', 'PROJ-1', 'Project Kickoff', 'Kickoff Presentation', 'Signed Charter', 'PM', 'PM', '', '2025-01-06', '2025-01-06', '2025-01-06', '2025-01-08', 'Done', '100', '', 'Vendor', 'Internal prep took longer', ''],
  ['2', 'Development',  'PROJ-2', 'Backend API',     'API Module',           'Test Report',    'Tech Lead', 'BE Team', 'SA', '2025-02-01', '2025-03-31', '2025-02-05', '', 'In Progress', '60', 'Sprint 1', 'Client', 'Waiting for client API spec', ''],
  ['3', 'Testing',      'PROJ-3', 'SIT',             'SIT Report',           'SIT Sign-off',   'QA Lead', 'QA Team', 'Dev', '2025-04-01', '2025-04-15', '', '', 'To-do', '0', '', 'N/A', '', ''],
];

// ─── Roadmap helpers ──────────────────────────────────────────────────────────
const MO_FULL  = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MO_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function rd(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function fmtD(s?: string | null): string {
  const d = rd(s);
  if (!d) return '—';
  return `${MO_SHORT[d.getMonth()]} ${d.getDate()}`;
}

const STATUS_BAR_COLOR: Record<string, { fill: string; ghost: string; border: string }> = {
  'New':                { fill: '#94a3b8', ghost: '#f8fafc', border: '#cbd5e1' },
  'To Do':              { fill: '#94a3b8', ghost: '#f8fafc', border: '#cbd5e1' },
  'To-do':              { fill: '#94a3b8', ghost: '#f8fafc', border: '#cbd5e1' },
  'REFINEMENT':         { fill: '#94a3b8', ghost: '#f8fafc', border: '#cbd5e1' },
  'In Dev':             { fill: '#3b82f6', ghost: '#dbeafe', border: '#60a5fa' },
  'In development':     { fill: '#3b82f6', ghost: '#dbeafe', border: '#60a5fa' },
  'Ready For Dev':      { fill: '#38bdf8', ghost: '#e0f2fe', border: '#7dd3fc' },
  'In Progress':        { fill: '#2563eb', ghost: '#dbeafe', border: '#60a5fa' },
  'In Review':          { fill: '#7c3aed', ghost: '#ede9fe', border: '#a78bfa' },
  'PENDING':            { fill: '#8b5cf6', ghost: '#ede9fe', border: '#a78bfa' },
  'In Testing':         { fill: '#d97706', ghost: '#fef3c7', border: '#fbbf24' },
  'Testing':            { fill: '#d97706', ghost: '#fef3c7', border: '#fbbf24' },
  'Ready for Test':     { fill: '#f59e0b', ghost: '#fef3c7', border: '#fbbf24' },
  'READY4TEST':         { fill: '#f59e0b', ghost: '#fef3c7', border: '#fbbf24' },
  'STAGING-READY4TEST': { fill: '#d97706', ghost: '#fef3c7', border: '#fbbf24' },
  'Re-Open':            { fill: '#ea580c', ghost: '#ffedd5', border: '#fb923c' },
  'Done':               { fill: '#16a34a', ghost: '#dcfce7', border: '#4ade80' },
  'UAT':                { fill: '#059669', ghost: '#d1fae5', border: '#34d399' },
  'Deployed':           { fill: '#0d9488', ghost: '#ccfbf1', border: '#2dd4bf' },
  'QC Done':            { fill: '#15803d', ghost: '#dcfce7', border: '#4ade80' },
  'READY TO RELEASE':   { fill: '#0f766e', ghost: '#ccfbf1', border: '#2dd4bf' },
  'READY FOR RELEASE':  { fill: '#0f766e', ghost: '#ccfbf1', border: '#2dd4bf' },
  'Passed QC':          { fill: '#15803d', ghost: '#dcfce7', border: '#4ade80' },
  'ANBM':               { fill: '#16a34a', ghost: '#dcfce7', border: '#4ade80' },
  'Blocked':            { fill: '#dc2626', ghost: '#fee2e2', border: '#f87171' },
  'Deferred':           { fill: '#64748b', ghost: '#f1f5f9', border: '#94a3b8' },
};
function statusBar(status: string) {
  return STATUS_BAR_COLOR[status] ?? { fill: '#94a3b8', ghost: '#f1f5f9', border: '#cbd5e1' };
}

function progressColor(pct: number): string {
  if (pct >= 100) return '#10b981';
  if (pct >= 75)  return '#22c55e';
  if (pct >= 50)  return '#3b82f6';
  if (pct >= 25)  return '#f59e0b';
  if (pct > 0)    return '#f97316';
  return '#94a3b8';
}

// ─── DateCell ─────────────────────────────────────────────────────────────────
function DateCell({ value, onChange, onBlur, warn, extraClass = '' }: {
  value: string; onChange: (v: string) => void; onBlur: () => void; warn: string | null; extraClass?: string;
}) {
  return (
    <div className="relative">
      <input
        type="date"
        className={`h-7 w-full text-xs border rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-blue-400
          ${warn ? 'border-orange-400 bg-orange-50/60' : 'border-slate-200 bg-white'} ${extraClass}`}
        value={value ?? ''}
        onChange={e => onChange(e.target.value)}
        onBlur={onBlur}
      />
      {warn && (
        <div title={warn} className="absolute -top-1.5 -right-1.5 z-20 w-4 h-4 rounded-full bg-orange-500 flex items-center justify-center cursor-help shadow">
          <span className="text-white font-bold leading-none" style={{ fontSize: 9 }}>!</span>
        </div>
      )}
    </div>
  );
}

// ─── ActivityDetail (Jira-like popup) ────────────────────────────────────────
function ActivityDetail({
  activity, teamMembers, projectId, onSave, onDelete, onClose, childActivities = [],
  onCreateChild, onViewChild,
}: {
  activity: Activity; teamMembers: TeamMember[]; projectId: string;
  onSave: (updated: Activity) => void; onDelete: (id: number) => void; onClose: () => void;
  childActivities?: Activity[];
  onCreateChild?: (name: string) => Promise<Activity>;
  onViewChild?: (child: Activity) => void;
}) {
  const [form, setForm] = useState<Activity>(activity);
  const [saving, setSaving] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [addingChild, setAddingChild] = useState(false);

  const upd = (field: keyof Activity, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const lag = calcLag(form.plan_end, form.actual_end, form.status);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/activities`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onSave(form);
  };

  const handleAddChild = async () => {
    if (!newChildName.trim() || !onCreateChild) return;
    setAddingChild(true);
    try {
      await onCreateChild(newChildName.trim());
      setNewChildName('');
      setIsAddingChild(false);
    } finally {
      setAddingChild(false);
    }
  };

  const canAddChildren = !activity.parent_id;
  const fieldCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="flex flex-col" style={{ maxHeight: '88vh' }}>
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 border-b bg-slate-50 shrink-0">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {form.jira_key && (
              <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600 shrink-0">{form.jira_key}</span>
            )}
            {activity.parent_id && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                <ChevronRight className="h-3 w-3 -mx-0.5" /> Sub-task
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_COLOR[form.status] ?? 'bg-slate-100 text-slate-500'}`}>{form.status}</span>
            {form.project_status && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${PROJECT_STATUS_COLOR[form.project_status] ?? 'bg-indigo-50 border-indigo-200 text-indigo-600'}`}>
                <Tag className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />{form.project_status}
              </span>
            )}
            <span className="text-xs text-slate-400 shrink-0">{form.phase}</span>
          </div>
          <h2 className="text-lg font-bold text-slate-800 leading-snug">
            {form.activity || <span className="italic text-slate-400 font-normal">Untitled Activity</span>}
          </h2>
        </div>
        <button onClick={onClose} className="shrink-0 p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left column */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5 border-r border-slate-100 min-w-0">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Activity</label>
            <textarea className={`${fieldCls} min-h-[70px] resize-y py-2 leading-relaxed`} value={form.activity} onChange={e => upd('activity', e.target.value)} placeholder="Activity description..." />
          </div>

          {/* Progress bar + children list */}
          {(() => {
            const pct = childActivities.length > 0
              ? weightedProgress(childActivities.map(c => c.status))
              : statusPct(form.status);
            const barFill = progressColor(pct);
            return (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Progress {childActivities.length > 0 ? '— weighted from children' : '— by status'}
                  </label>
                  {canAddChildren && onCreateChild && (
                    <button
                      onClick={() => setIsAddingChild(true)}
                      className="flex items-center gap-1 text-[10px] font-semibold text-white hover:opacity-90 px-2 py-0.5 rounded-full transition-opacity"
                      style={{ background: 'linear-gradient(90deg, #6366f1, #3b82f6)' }}
                    >
                      <Plus className="h-3 w-3" /> Add child
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div className="h-2.5 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: barFill }} />
                  </div>
                  <span className="text-sm font-bold tabular-nums w-10 text-right" style={{ color: barFill }}>{pct}%</span>
                </div>

                {/* Children list */}
                {childActivities.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {childActivities.map(child => (
                      <div
                        key={child.id}
                        className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer hover:bg-blue-50/60 hover:border-blue-200 transition-colors group/child"
                        onClick={() => onViewChild?.(child)}
                      >
                        {child.jira_key && (
                          <span className="text-[10px] font-mono text-slate-400 shrink-0 group-hover/child:text-blue-500">{child.jira_key}</span>
                        )}
                        <span className="text-xs text-slate-700 flex-1 truncate group-hover/child:text-blue-700">{child.activity || '—'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_COLOR[child.status] ?? 'bg-slate-100 text-slate-500'}`}>{child.status}</span>
                        <Eye className="h-3 w-3 text-slate-300 group-hover/child:text-blue-400 shrink-0 transition-colors" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline add child */}
                {isAddingChild && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      autoFocus
                      type="text"
                      value={newChildName}
                      onChange={e => setNewChildName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddChild();
                        if (e.key === 'Escape') { setIsAddingChild(false); setNewChildName(''); }
                      }}
                      placeholder="Child task name..."
                      className="flex-1 h-8 text-sm border border-blue-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    />
                    <button
                      onClick={handleAddChild}
                      disabled={addingChild || !newChildName.trim()}
                      className="h-8 px-3 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {addingChild ? '…' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setIsAddingChild(false); setNewChildName(''); }}
                      className="h-8 px-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Deliverable</label>
            <input type="text" className={`${fieldCls} h-9`} value={form.deliverable} onChange={e => upd('deliverable', e.target.value)} placeholder="Expected deliverable..." />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Sign-off Document</label>
            <input type="text" className={`${fieldCls} h-9`} value={form.sign_off_doc} onChange={e => upd('sign_off_doc', e.target.value)} placeholder="Sign-off document..." />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea className={`${fieldCls} min-h-[90px] resize-y py-2 leading-relaxed`} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="Additional notes..." />
          </div>

          {/* Lag & Delay section */}
          <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Lag &amp; Delay</p>
              <LagBadge lag={lag} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Delay Owner</label>
              <Select value={form.delay_owner || 'N/A'} onValueChange={v => upd('delay_owner', v ?? 'N/A')}>
                <SelectTrigger className={`h-9 text-sm ${form.delay_owner && form.delay_owner !== 'N/A' ? DELAY_OWNER_COLOR[form.delay_owner] : ''}`}><SelectValue /></SelectTrigger>
                <SelectContent>{DELAY_OWNERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Delay Reason</label>
              <textarea
                className="w-full text-sm border border-orange-200/70 rounded-lg px-3 py-2 min-h-[75px] resize-y focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white/80 leading-relaxed"
                value={form.delay_reason} onChange={e => upd('delay_reason', e.target.value)} placeholder="Describe the reason for delay..." />
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-80 shrink-0 p-5 overflow-y-auto bg-slate-50/40 space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
            <Select value={form.status} onValueChange={v => upd('status', v ?? '')}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {/* Schedule */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Schedule</p>
            <div className="grid grid-cols-2 gap-3">
              {([['Plan Start','plan_start'],['Plan End','plan_end'],['Actual Start','actual_start'],['Actual End','actual_end']] as [string, keyof Activity][]).map(([lbl, field]) => (
                <div key={field}>
                  <span className="text-[10px] text-slate-400 font-medium block mb-1">{lbl}</span>
                  <input type="date" value={(form[field] as string) ?? ''}
                    onChange={e => upd(field, e.target.value)}
                    className="h-7 w-full text-xs border border-slate-200 rounded px-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              ))}
            </div>
          </div>

          {/* People */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">People</p>
            {([['Accountable','accountable'],['Responsible','responsible'],['Support','support']] as [string, keyof Activity][]).map(([lbl, field]) => (
              <div key={field}>
                <span className="text-[10px] text-slate-400 font-medium block mb-1">{lbl}</span>
                <input type="text" list={`team-${projectId}`}
                  value={(form[field] as string) ?? ''}
                  onChange={e => upd(field, e.target.value)}
                  className="h-7 w-full text-xs border border-slate-200 rounded px-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Select..." />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-white px-6 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => onDelete(form.id)}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors">
          <Trash2 className="h-4 w-4" /> Delete Activity
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} className="h-9">Close</Button>
          <Button onClick={handleSave} disabled={saving} className="h-9 bg-blue-600 hover:bg-blue-700 text-white gap-2">
            {saving && <Save className="h-4 w-4 animate-pulse" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── RoadmapView ──────────────────────────────────────────────────────────────
function RoadmapView({
  phaseGroups, innerRef, holidays, dateMode,
  collapsedPhases, onTogglePhase,
  collapsedParents, onToggleParent,
  onOpenDetail,
  viewYear, viewPeriod,
}: {
  phaseGroups: { phase: string; acts: Activity[] }[];
  innerRef: React.RefObject<HTMLDivElement | null>;
  holidays: Holiday[];
  dateMode: DateMode;
  collapsedPhases: Set<string>;
  onTogglePhase: (phase: string) => void;
  collapsedParents: Set<number>;
  onToggleParent: (id: number) => void;
  onOpenDetail: (a: Activity) => void;
  viewYear: number | null;
  viewPeriod: string;
}) {
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const allMs: number[] = [];
  for (const { acts } of phaseGroups)
    for (const a of acts) {
      if (dateMode !== 'actual') {
        const s = rd(a.plan_start), e = rd(a.plan_end);
        if (s) allMs.push(s.getTime());
        if (e) allMs.push(e.getTime());
      }
      if (dateMode !== 'plan') {
        const s = rd(a.actual_start);
        const e = rd(a.actual_end) ?? (a.actual_start ? today : null);
        if (s) allMs.push(s.getTime());
        if (e) allMs.push(e.getTime());
      }
    }

  const emptyLabel = dateMode === 'actual'
    ? 'Chưa có Actual Start/End để hiển thị'
    : 'Điền Plan Start và Plan End cho các activity trước.';

  // Compute rangeStart / rangeEnd
  let rangeStart: Date, rangeEnd: Date;
  if (viewYear !== null) {
    if (viewPeriod === 'q1')           { rangeStart = new Date(viewYear, 0, 1);  rangeEnd = new Date(viewYear, 2, 31); }
    else if (viewPeriod === 'q2')      { rangeStart = new Date(viewYear, 3, 1);  rangeEnd = new Date(viewYear, 5, 30); }
    else if (viewPeriod === 'q3')      { rangeStart = new Date(viewYear, 6, 1);  rangeEnd = new Date(viewYear, 8, 30); }
    else if (viewPeriod === 'q4')      { rangeStart = new Date(viewYear, 9, 1);  rangeEnd = new Date(viewYear, 11, 31); }
    else if (viewPeriod.startsWith('m')) {
      const mo = parseInt(viewPeriod.slice(1));
      rangeStart = new Date(viewYear, mo, 1);
      rangeEnd   = new Date(viewYear, mo + 1, 0);
    } else {
      rangeStart = new Date(viewYear, 0, 1);
      rangeEnd   = new Date(viewYear, 11, 31);
    }
  } else {
    if (!allMs.length) {
      return (
        <div className="rounded-xl border bg-white py-20 text-center text-slate-400 shadow-sm">
          <GanttChart className="h-12 w-12 mx-auto mb-3 opacity-15" />
          <p className="text-sm font-semibold">Chưa có dữ liệu để hiển thị Roadmap</p>
          <p className="text-xs mt-1">{emptyLabel}</p>
        </div>
      );
    }
    const minMs = Math.min(...allMs), maxMs = Math.max(...allMs);
    rangeStart = new Date(new Date(minMs).getFullYear(), new Date(minMs).getMonth(), 1);
    rangeEnd   = new Date(new Date(maxMs).getFullYear(), new Date(maxMs).getMonth() + 1, 0);
  }

  const totalDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000) + 1;
  const ppd = Math.max(3, Math.min(32, Math.round(1100 / totalDays)));
  const totalW  = totalDays * ppd;
  const weekW   = 7 * ppd;
  const showWeekLabel = weekW >= 18;

  interface WeekCell { label: string; sx: number; w: number; }
  interface MonthCell { label: string; fullLabel: string; year: number; sx: number; totalW: number; weeks: WeekCell[]; }
  const months: MonthCell[] = [];
  {
    let cur = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
    while (cur <= rangeEnd) {
      const yr = cur.getFullYear(), mo = cur.getMonth();
      const lastDay = new Date(yr, mo + 1, 0).getDate();
      const mStartPx = Math.max(0, Math.round((cur.getTime() - rangeStart.getTime()) / 86_400_000) * ppd);
      const mEndPx   = Math.min(totalW, (Math.round((new Date(yr, mo, lastDay).getTime() - rangeStart.getTime()) / 86_400_000) + 1) * ppd);
      const wDefs = [
        { label: 'W1', d0: 1, d1: 7 }, { label: 'W2', d0: 8, d1: 14 },
        { label: 'W3', d0: 15, d1: 21 }, { label: 'W4', d0: 22, d1: lastDay },
      ];
      const weeks: WeekCell[] = wDefs.map(({ label, d0, d1 }) => {
        const wsx = Math.max(0, Math.round((new Date(yr, mo, d0).getTime() - rangeStart.getTime()) / 86_400_000) * ppd);
        const wex = Math.min(totalW, (Math.round((new Date(yr, mo, Math.min(d1, lastDay)).getTime() - rangeStart.getTime()) / 86_400_000) + 1) * ppd);
        return { label, sx: wsx, w: Math.max(0, wex - wsx) };
      }).filter(w => w.w > 0);
      months.push({ label: MO_SHORT[mo], fullLabel: MO_FULL[mo], year: yr, sx: mStartPx, totalW: Math.max(0, mEndPx - mStartPx), weeks });
      cur = new Date(yr, mo + 1, 1);
    }
  }
  const multiYear = new Set(months.map(m => m.year)).size > 1;
  const yearGroups: { year: number; w: number }[] = [];
  for (const m of months) {
    if (yearGroups.length && yearGroups[yearGroups.length - 1].year === m.year)
      yearGroups[yearGroups.length - 1].w += m.totalW;
    else yearGroups.push({ year: m.year, w: m.totalW });
  }

  const todayX    = Math.round((today.getTime() - rangeStart.getTime()) / 86_400_000) * ppd;
  const showToday = todayX > 0 && todayX < totalW;

  const weekendBands: { x: number; w: number }[] = [];
  {
    const d = new Date(rangeStart);
    d.setDate(d.getDate() + ((6 - d.getDay() + 7) % 7));
    while (d <= rangeEnd) {
      const sx = Math.round((d.getTime() - rangeStart.getTime()) / 86_400_000) * ppd;
      const bw = Math.min(2 * ppd, totalW - sx);
      if (bw > 0) weekendBands.push({ x: sx, w: bw });
      d.setDate(d.getDate() + 7);
    }
  }

  const holidayMarkers: { x: number; name: string }[] = holidays
    .map(h => ({ d: rd(h.date), name: h.name }))
    .filter(h => h.d !== null)
    .map(h => ({ x: Math.round((h.d!.getTime() - rangeStart.getTime()) / 86_400_000) * ppd, name: h.name }))
    .filter(h => h.x >= 0 && h.x < totalW);

  function pBar(a: Activity) {
    const s = rd(a.plan_start), e = rd(a.plan_end);
    if (!s || !e) return null;
    const sx = Math.round((s.getTime() - rangeStart.getTime()) / 86_400_000) * ppd;
    const ex = Math.round((e.getTime() - rangeStart.getTime()) / 86_400_000) * ppd + ppd;
    const lx = Math.max(0, sx), rx = Math.min(totalW, ex);
    if (rx <= lx) return null;
    return { lx, w: rx - lx };
  }
  function aBar(a: Activity) {
    const s = rd(a.actual_start);
    if (!s) return null;
    const e = rd(a.actual_end) ?? today;
    const sx = Math.round((s.getTime() - rangeStart.getTime()) / 86_400_000) * ppd;
    const ex = Math.round((e.getTime() - rangeStart.getTime()) / 86_400_000) * ppd + ppd;
    const lx = Math.max(0, sx), rx = Math.min(totalW, ex);
    if (rx <= lx) return null;
    return { lx, w: rx - lx };
  }

  const ROW   = dateMode === 'both' ? 58 : 50;
  const LEFT  = 268;
  const HDR   = (multiYear ? 22 : 0) + 26 + 22;
  const totalBodyH = phaseGroups.reduce((h, { phase, acts }) => {
    if (collapsedPhases.has(phase)) return h + 30;
    const parents = acts.filter(a => !a.parent_id);
    let visRows = 0;
    for (const p of parents) {
      visRows++;
      if (!collapsedParents.has(p.id)) visRows += acts.filter(c => c.parent_id === p.id).length;
    }
    return h + 30 + visRows * ROW;
  }, 0);

  return (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <div ref={innerRef} style={{ minWidth: LEFT + totalW + 24, background: '#fff' }}>

          {/* Header */}
          <div style={{ display: 'flex', background: '#0f172a', height: HDR }}>
            <div style={{ width: LEFT, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'flex-end', padding: '0 14px 8px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em' }}>ACTIVITY</span>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              {multiYear && (
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 22, display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {yearGroups.map((yg, i) => (
                    <div key={i} style={{ width: yg.w, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#e2e8f0' }}>{yg.year}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ position: 'absolute', top: multiYear ? 22 : 0, left: 0, right: 0, height: 26, display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {months.map((m, i) => (
                  <div key={i} style={{ width: m.totalW, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                    <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 600, padding: '0 4px',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {m.totalW > 60 ? m.fullLabel : m.label}{!multiYear ? ` '${String(m.year).slice(2)}` : ''}
                    </span>
                  </div>
                ))}
              </div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 22, display: 'flex' }}>
                {months.map(m =>
                  m.weeks.map((wk, wi) => (
                    <div key={`${m.year}-${m.label}-${wi}`} style={{ width: wk.w, flexShrink: 0,
                      borderRight: wi === m.weeks.length - 1 ? '1.5px solid rgba(255,255,255,0.18)' : '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {showWeekLabel && <span style={{ fontSize: 9, color: '#64748b', fontWeight: 500 }}>{wk.label}</span>}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div style={{ position: 'relative' }}>
            {/* Weekend + holiday shading */}
            <div style={{ position: 'absolute', left: LEFT, top: 0, height: totalBodyH, pointerEvents: 'none', zIndex: 0, overflow: 'hidden', right: 0 }}>
              {weekendBands.map((b, i) => (
                <div key={i} style={{ position: 'absolute', left: b.x, width: b.w, top: 0, bottom: 0, background: 'rgba(0,0,0,0.028)' }} />
              ))}
              {holidayMarkers.map((h, i) => (
                <div key={i} style={{ position: 'absolute', left: h.x, width: ppd, top: 0, bottom: 0, background: 'rgba(249,115,22,0.10)' }}>
                  <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: '#f97316', opacity: 0.7 }} />
                </div>
              ))}
            </div>

            {phaseGroups.map(({ phase, acts }, phaseIdx) => {
              const pSt        = getPhaseStyle(phase);
              const isCollapsed = collapsedPhases.has(phase);
              const phaseLag   = Math.max(0, ...acts.map(a => calcLag(a.plan_end, a.actual_end, a.status)));
              const phaseEven  = phaseIdx % 2 === 0;

              // Compute phase span from all activities
              const phaseStart = acts.reduce((min, a) => a.plan_start && (!min || a.plan_start < min) ? a.plan_start : min, '');
              const phaseEnd   = acts.reduce((max, a) => a.plan_end && (!max || a.plan_end > max) ? a.plan_end : max, '');
              const phaseSpanBar = phaseStart && phaseEnd ? pBar({ plan_start: phaseStart, plan_end: phaseEnd } as Activity) : null;

              return (
                <React.Fragment key={phase}>
                  {/* Phase header */}
                  <div className={`flex border-b ${pSt.bg}`}
                    style={{ height: 30, position: 'relative', zIndex: 2, borderTop: phaseIdx > 0 ? '2px solid rgba(0,0,0,0.08)' : undefined }}>
                    <div className={`flex items-center px-3 border-r border-slate-200 shrink-0 ${pSt.text}`} style={{ width: LEFT }}>
                      <button
                        onClick={() => onTogglePhase(phase)}
                        className="flex items-center gap-1.5 w-full h-full text-left"
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
                      >
                        {isCollapsed
                          ? <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-50" />
                          : <ChevronDown  className="w-3.5 h-3.5 shrink-0 opacity-50" />}
                        <div className={`w-2 h-2 rounded-full shrink-0 ${pSt.bar}`} />
                        <span className="text-[11px] font-bold uppercase tracking-widest truncate">{phase}</span>
                        <span className="text-[10px] font-normal opacity-50 shrink-0 ml-1">({acts.length})</span>
                        {phaseLag > 0 && <span className="ml-1 text-[9px] font-bold text-red-600 shrink-0 bg-red-100 px-1 rounded">+{phaseLag}d</span>}
                        {isCollapsed && phaseStart && phaseEnd && (
                          <span className="text-[9px] text-blue-500 tabular-nums shrink-0 ml-1.5 opacity-80 font-medium">
                            {fmtD(phaseStart)}→{fmtD(phaseEnd)}
                          </span>
                        )}
                      </button>
                    </div>
                    <div className="relative flex-1">
                      {months.map(m => m.weeks.map((wk, wi) => (
                        <div key={`${m.label}-${wi}`} className="absolute inset-y-0"
                          style={{ left: wk.sx, borderRight: wi === m.weeks.length - 1 ? '1.5px solid rgba(100,116,139,0.25)' : '1px solid rgba(100,116,139,0.10)' }} />
                      )))}
                      {showToday && <div className="absolute inset-y-0 w-px" style={{ left: todayX, background: '#f87171', opacity: 0.4 }} />}
                      {phaseSpanBar && (
                        <div style={{
                          position: 'absolute', left: phaseSpanBar.lx, width: phaseSpanBar.w, height: 16,
                          top: '50%', transform: 'translateY(-50%)',
                          background: pSt.hex + '28', border: `1.5px solid ${pSt.hex}`,
                          borderRadius: 9999, zIndex: 1,
                        }} />
                      )}
                    </div>
                  </div>

                  {/* Activity rows — with per-epic collapse */}
                  {!isCollapsed && (() => {
                    // Build local children map for this phase
                    const localKids = new Map<number, Activity[]>();
                    for (const a of acts) {
                      if (a.parent_id) {
                        if (!localKids.has(a.parent_id)) localKids.set(a.parent_id, []);
                        localKids.get(a.parent_id)!.push(a);
                      }
                    }
                    // Flatten rows: parents first, then visible children
                    const parentActs = acts.filter(a => !a.parent_id);
                    const flatRows: Activity[] = [];
                    for (const p of parentActs) {
                      flatRows.push(p);
                      if (!collapsedParents.has(p.id)) flatRows.push(...(localKids.get(p.id) ?? []));
                    }
                    // Include orphan children (parent in a different phase)
                    const parentIds = new Set(parentActs.map(p => p.id));
                    acts.filter(a => a.parent_id && !parentIds.has(a.parent_id)).forEach(a => flatRows.push(a));

                    return flatRows.map((a, ri) => {
                      const pb = pBar(a), ab = aBar(a);
                      const lag     = calcLag(a.plan_end, a.actual_end, a.status);
                      const overdue = lag > 0 && !DONE_STATUSES.has(a.status);
                      const sb = statusBar(a.status);
                      const fc = sb.fill;

                      const showPlan   = dateMode !== 'actual';
                      const showActual = dateMode !== 'plan';
                      const dualBar    = showPlan && showActual && !!ab;
                      const planShift  = dualBar ? 'translateY(calc(-50% - 4px))' : 'translateY(-50%)';
                      const actualEndLabel = a.actual_end ? fmtD(a.actual_end) : (a.actual_start ? 'now' : '—');
                      const isChild = !!a.parent_id;
                      const kids = localKids.get(a.id) ?? [];
                      const hasKids = kids.length > 0;
                      const isEpicCollapsed = !isChild && collapsedParents.has(a.id);
                      const epicPct = hasKids ? weightedProgress(kids.map(c => c.status)) : 0;

                      const rowBg = overdue
                        ? '!bg-red-50/50'
                        : !isChild && hasKids
                          ? (phaseEven ? 'bg-slate-50/70' : 'bg-indigo-50/30')
                          : phaseEven
                            ? (ri % 2 === 1 ? 'bg-slate-50/30' : 'bg-white')
                            : (ri % 2 === 1 ? 'bg-indigo-50/20' : 'bg-slate-50/60');

                      return (
                        <div key={a.id}
                          className={`flex border-b transition-colors hover:bg-blue-50/30 cursor-pointer ${rowBg}`}
                          style={{ height: ROW, position: 'relative', zIndex: 1 }}
                          onClick={() => onOpenDetail(a)}>

                          {/* Left panel — Key · Activity · Status only */}
                          <div className="flex items-center border-r border-slate-100 shrink-0"
                            style={{ width: LEFT, height: ROW, borderLeft: `3px solid ${isChild ? pSt.hex + '30' : pSt.hex + (hasKids ? 'cc' : '50')}`, paddingLeft: isChild ? 28 : 8, paddingRight: 8 }}>
                            <div className="min-w-0 flex-1">
                              {/* Line 1: toggle + key + name */}
                              <div className="flex items-center gap-1 min-w-0">
                                {!isChild && hasKids && (
                                  <button
                                    onClick={e => { e.stopPropagation(); onToggleParent(a.id); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px', display: 'flex', flexShrink: 0 }}
                                  >
                                    {isEpicCollapsed
                                      ? <ChevronRight className="w-3 h-3 text-slate-400" />
                                      : <ChevronDown  className="w-3 h-3 text-slate-400" />}
                                  </button>
                                )}
                                {a.jira_key && (
                                  <span className="text-[9px] font-mono text-slate-400 shrink-0">{a.jira_key}</span>
                                )}
                                <p className={`text-[11px] truncate leading-tight ${isChild ? 'text-slate-500 font-medium' : hasKids ? 'font-bold text-slate-800' : 'font-semibold text-slate-700'}`}>
                                  {a.activity || '—'}
                                </p>
                              </div>
                              {/* Line 2: status + mini progress (epics) + collapsed count */}
                              <div className="flex items-center gap-1 mt-0.5 min-w-0">
                                <span className={`text-[9px] px-1 py-px rounded font-bold shrink-0 ${STATUS_COLOR[a.status] ?? 'bg-slate-100 text-slate-500'}`}>{a.status}</span>
                                {overdue && <span className="text-[9px] font-bold text-red-500 shrink-0">+{lag}d</span>}
                                {isEpicCollapsed && kids.length > 0 && (
                                  <span className="text-[9px] text-slate-400 shrink-0">({kids.length})</span>
                                )}
                                {!isChild && hasKids && !isEpicCollapsed && (
                                  <div className="flex items-center gap-1 min-w-0 flex-1">
                                    <div style={{ flex: 1, height: 3, background: '#e2e8f0', borderRadius: 9999, overflow: 'hidden', minWidth: 20 }}>
                                      <div style={{ height: 3, width: `${epicPct}%`, background: progressColor(epicPct), borderRadius: 9999, transition: 'width 0.3s' }} />
                                    </div>
                                    <span style={{ fontSize: 8, fontWeight: 700, color: progressColor(epicPct), whiteSpace: 'nowrap', minWidth: 20, textAlign: 'right', flexShrink: 0 }}>{epicPct}%</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Bar area */}
                          <div className="relative flex-1" style={{ height: ROW }}>
                            {months.map(m => m.weeks.map((wk, wi) => (
                              <div key={`${m.label}-${wi}`} className="absolute inset-y-0"
                                style={{ left: wk.sx, borderRight: wi === m.weeks.length - 1 ? '1.5px solid rgba(100,116,139,0.12)' : '1px solid rgba(100,116,139,0.06)' }} />
                            )))}
                            {showToday && (
                              <div className="absolute inset-y-0 z-10" style={{ left: todayX }}>
                                <div className="w-px h-full" style={{ background: '#f87171', opacity: 0.7 }} />
                              </div>
                            )}
                            {showPlan && pb && (
                              <div style={{
                                position: 'absolute', left: pb.lx, width: pb.w, height: 18,
                                top: '50%', transform: planShift,
                                background: sb.ghost, border: `2px solid ${sb.border}`, borderRadius: 9999,
                              }} />
                            )}
                            {showPlan && pb && a.completion_pct > 0 && (
                              <div style={{
                                position: 'absolute', left: pb.lx,
                                width: Math.round(pb.w * a.completion_pct / 100), height: 18,
                                top: '50%', transform: planShift,
                                background: progressColor(a.completion_pct), opacity: 0.92, borderRadius: 9999,
                              }} />
                            )}
                            {showPlan && pb && pb.w >= 38 && a.completion_pct > 0 && (
                              <div style={{
                                position: 'absolute', left: pb.lx + 5, top: '50%', transform: planShift,
                                fontSize: 9, fontWeight: 700, color: a.completion_pct > 28 ? '#fff' : sb.fill,
                                lineHeight: '18px', zIndex: 20, pointerEvents: 'none',
                              }}>{a.completion_pct}%</div>
                            )}
                            {showActual && ab && (
                              dateMode === 'actual'
                                ? <div style={{
                                    position: 'absolute', left: ab.lx, width: ab.w, height: 16,
                                    top: '50%', transform: 'translateY(-50%)',
                                    background: fc, opacity: 0.85,
                                    border: `2px solid ${sb.border}`, borderRadius: 9999,
                                  }} />
                                : <div style={{
                                    position: 'absolute', left: ab.lx, width: ab.w, height: 6,
                                    top: '50%', transform: 'translateY(5px)',
                                    background: fc, opacity: 0.55, borderRadius: 9999,
                                  }} />
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </React.Fragment>
              );
            })}
          </div>

          {/* Today footer */}
          {showToday && (
            <div className="relative border-t bg-slate-50" style={{ height: 22 }}>
              <div className="absolute inset-y-0 w-px bg-red-400/50" style={{ left: LEFT + todayX }} />
              <div className="absolute bottom-1" style={{ left: LEFT + todayX + 3 }}>
                <span className="text-[9px] font-bold text-red-500 bg-white border border-red-200 rounded px-1 py-px whitespace-nowrap">Today</span>
              </div>
            </div>
          )}

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 border-t bg-slate-50/70">
            {([
              dateMode !== 'actual' && ['Plan range',     <div key="a" style={{ width:28, height:14, background:'#dbeafe', border:'2px solid #60a5fa', borderRadius:9999 }} />] as [string, React.ReactNode],
              dateMode !== 'actual' && ['In Progress',    <div key="b" style={{ width:28, height:14, background:'#2563eb', borderRadius:9999, opacity:.9 }} />] as [string, React.ReactNode],
              ['Done',                                    <div key="c" style={{ width:28, height:14, background:'#16a34a', borderRadius:9999, opacity:.9 }} />],
              ['Blocked',                                 <div key="d" style={{ width:28, height:14, background:'#dc2626', borderRadius:9999, opacity:.9 }} />],
              dateMode === 'actual' && ['Actual (solid)', <div key="e2" style={{ width:28, height:14, background:'#2563eb', opacity:.85, border:'2px solid #60a5fa', borderRadius:9999 }} />] as [string, React.ReactNode],
              dateMode === 'both' && ['Actual period',    <div key="e" style={{ width:28, height:6, background:'#16a34a', borderRadius:9999, opacity:.55 }} />] as [string, React.ReactNode],
              ['Weekend',                                 <div key="f" style={{ width:14, height:14, background:'rgba(0,0,0,0.06)', borderRadius:2 }} />],
              ['Holiday',                                 <div key="g" style={{ width:14, height:14, background:'rgba(249,115,22,0.15)', borderTop:'3px solid #f97316', borderRadius:2 }} />],
              ['Today',                                   <div key="h" style={{ width:2, height:14, background:'#f87171', opacity:.7 }} />],
            ].filter(Boolean) as [string, React.ReactNode][]).map(([label, el]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="flex items-center justify-center" style={{ width:30, height:16 }}>{el}</div>
                <span className="text-[10px] text-slate-500 whitespace-nowrap">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function TimelinePage() {
  const { id } = useParams<{ id: string }>();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [project, setProject] = useState<Project | null>(null);
  const [filterPhase, setFilterPhase] = useState('All');
  const [saving, setSaving] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [jiraSyncOpen, setJiraSyncOpen] = useState(false);
  const [detailActivity, setDetailActivity] = useState<Activity | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'roadmap'>('table');
  const [dateMode, setDateMode] = useState<DateMode>('both');
  const roadmapRef = useRef<HTMLDivElement>(null);

  // Roadmap navigation state
  const [collapsedPhases, setCollapsedPhases] = useState<Set<string>>(new Set());
  const [roadmapYear,   setRoadmapYear]   = useState<number | null>(null);
  const [roadmapPeriod, setRoadmapPeriod] = useState<string>('all');

  // Table state
  const [collapsedTablePhases, setCollapsedTablePhases] = useState<Set<string>>(new Set());
  const [collapsedParents, setCollapsedParents] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(30);

  // Context menu
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  // Inline activity name editing
  const [editingActivityId, setEditingActivityId] = useState<number | null>(null);
  const newActivityIdRef = useRef<number | null>(null);

  // Holidays
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [newHDate, setNewHDate] = useState('');
  const [newHName, setNewHName] = useState('');
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener('click', handler);
    document.addEventListener('contextmenu', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('contextmenu', handler);
    };
  }, [contextMenu]);

  const getDateWarn = useCallback((dateStr: string | null | undefined): string | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    const dow = d.getDay();
    if (dow === 6) return 'Thứ Bảy — ngày cuối tuần';
    if (dow === 0) return 'Chủ Nhật — ngày cuối tuần';
    if (holidaySet.has(dateStr)) {
      const h = holidays.find(h => h.date === dateStr);
      return h?.name ? `Nghỉ lễ: ${h.name}` : 'Ngày nghỉ lễ';
    }
    return null;
  }, [holidaySet, holidays]);

  const addHoliday = async () => {
    if (!newHDate) return;
    const res = await fetch(`/api/projects/${id}/holidays`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newHDate, name: newHName }),
    });
    if (res.status === 409) { toast.error('Ngày này đã được thêm rồi'); return; }
    const row = await res.json();
    setHolidays(h => [...h, row].sort((a, b) => a.date.localeCompare(b.date)));
    setNewHDate(''); setNewHName('');
    toast.success('Đã thêm ngày nghỉ');
  };

  const removeHoliday = async (hid: number) => {
    await fetch(`/api/projects/${id}/holidays?hid=${hid}`, { method: 'DELETE' });
    setHolidays(h => h.filter(x => x.id !== hid));
  };

  const handleExportPng = async () => {
    if (!roadmapRef.current) { toast.error('Roadmap chưa render'); return; }
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(roadmapRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const a = document.createElement('a');
      a.download = 'roadmap.png'; a.href = dataUrl; a.click();
      toast.success('Exported roadmap.png');
    } catch {
      toast.error('Export PNG thất bại');
    }
  };

  const load = useCallback(() => {
    fetch(`/api/projects/${id}/activities`).then(r => r.json()).then(setActivities);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch(`/api/projects/${id}`).then(r => r.json()).then(setProject); }, [id]);
  useEffect(() => { fetch(`/api/projects/${id}/team`).then(r => r.json()).then(setTeamMembers); }, [id]);
  useEffect(() => { fetch(`/api/projects/${id}/holidays`).then(r => r.json()).then(setHolidays); }, [id]);

  // Add parent-level activity in project's current phase
  const addActivity = async () => {
    const phase = project?.current_phase ?? activities[0]?.phase ?? DEFAULT_PHASES[0];
    const res = await fetch(`/api/projects/${id}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase, activity: '', jira_key: generateKey(), sprint: '', project_status: project?.status ?? '', parent_id: null }),
    });
    const row = await res.json();
    setActivities(a => [...a, row]);
    newActivityIdRef.current = row.id;
    setEditingActivityId(row.id);
  };

  // Create child activity under a parent
  const createChild = async (parentId: number) => {
    const parent = activities.find(a => a.id === parentId);
    if (!parent) return;
    const res = await fetch(`/api/projects/${id}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: parent.phase, activity: 'New Task', parent_id: parentId, status: 'To-do', jira_key: generateKey(), project_status: project?.status ?? '' }),
    });
    const row = await res.json();
    setActivities(a => [...a, row]);
    setCollapsedParents(prev => { const n = new Set(prev); n.delete(parentId); return n; });
    toast.success('Child task created');
  };

  // Duplicate an activity (no children duplication)
  const duplicateActivity = async (activity: Activity) => {
    const { id: _id, order_idx: _order, ...fields } = activity;
    const res = await fetch(`/api/projects/${id}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...fields, activity: `${activity.activity} (copy)`, jira_key: generateKey() }),
    });
    const row = await res.json();
    setActivities(a => [...a, row]);
    toast.success('Duplicated');
  };

  const updateField = (rowId: number, field: string, value: string | number) =>
    setActivities(a => a.map(r => r.id === rowId ? { ...r, [field]: value } : r));

  const saveRow = async (row: Activity) => {
    setSaving(row.id);
    await fetch(`/api/projects/${id}/activities`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row),
    });
    setSaving(null);
  };

  const deleteRow = async (rowId: number) => {
    await fetch(`/api/projects/${id}/activities?rowId=${rowId}`, { method: 'DELETE' });
    setActivities(a => a.filter(r => r.id !== rowId));
    toast.success('Deleted');
  };

  const handleExport = () => {
    const list = filterPhase === 'All' ? activities : activities.filter(a => a.phase === filterPhase);
    if (!list.length) { toast.error('No activities to export'); return; }
    downloadCSV(activitiesToCSV(list), 'project-timeline.csv');
    toast.success(`Exported ${list.length} activities`);
  };

  const handleDownloadTemplate = () => {
    const lines = [CSV_HEADERS.join(','), ...TEMPLATE_ROWS.map(r => r.map(escapeCSV).join(','))];
    downloadCSV(lines.join('\r\n'), 'timeline-template.csv');
    toast.success('Template downloaded');
  };

  const allPhases = useMemo(() => {
    const seen = new Set<string>(); const result: string[] = [];
    for (const a of activities) {
      if (a.phase && !seen.has(a.phase)) { seen.add(a.phase); result.push(a.phase); }
    }
    for (const p of DEFAULT_PHASES) { if (!seen.has(p)) result.push(p); }
    return result;
  }, [activities]);

  const dataYears = useMemo(() => {
    const years = new Set<number>();
    for (const a of activities) {
      [a.plan_start, a.plan_end, a.actual_start, a.actual_end].forEach(d => {
        if (d) { const y = new Date(d + 'T00:00:00').getFullYear(); if (!isNaN(y)) years.add(y); }
      });
    }
    years.add(new Date().getFullYear());
    return [...years].sort();
  }, [activities]);

  const overdueCount = activities.filter(a => !DONE_STATUSES.has(a.status) && calcLag(a.plan_end, a.actual_end, a.status) > 0).length;

  // Auto-generate jira key: first 3 letters of project name + max-existing-num + 1
  const generateKey = useCallback(() => {
    if (!project) return '';
    const prefix = (project.name.replace(/[^a-zA-Z]/g, '').slice(0, 3) || project.name.slice(0, 3)).toUpperCase();
    const maxNum = activities.reduce((max, a) => {
      if (!a.jira_key) return max;
      const m = a.jira_key.match(/-(\d+)$/);
      return m ? Math.max(max, parseInt(m[1], 10)) : max;
    }, 0);
    return `${prefix}-${String(maxNum + 1).padStart(2, '0')}`;
  }, [project, activities]);

  // Create child from within the ActivityDetail popup
  const createChildFromDetail = useCallback(async (parentId: number, name: string): Promise<Activity> => {
    const parent = activities.find(a => a.id === parentId);
    const res = await fetch(`/api/projects/${id}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phase: parent?.phase ?? DEFAULT_PHASES[0],
        activity: name,
        parent_id: parentId,
        status: 'To-do',
        jira_key: generateKey(),
        project_status: project?.status ?? '',
      }),
    });
    const row = await res.json();
    setActivities(a => [...a, row]);
    setCollapsedParents(prev => { const n = new Set(prev); n.delete(parentId); return n; });
    return row;
  }, [id, activities, generateKey, project]);

  // ─── Phase groups (used by both table and roadmap) ────────────────────────
  const filteredActivities = filterPhase === 'All' ? activities : activities.filter(a => a.phase === filterPhase);

  const phaseGroups = useMemo((): { phase: string; acts: Activity[] }[] => {
    const seenPhases = new Set<string>();
    const groups: { phase: string; acts: Activity[] }[] = [];
    for (const a of filteredActivities) {
      if (!seenPhases.has(a.phase)) {
        seenPhases.add(a.phase);
        groups.push({ phase: a.phase, acts: filteredActivities.filter(x => x.phase === a.phase) });
      }
    }
    return groups;
  }, [filteredActivities]);

  const togglePhase = useCallback((phase: string) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase); else next.add(phase);
      return next;
    });
  }, []);

  const toggleTablePhase = useCallback((phase: string) => {
    setCollapsedTablePhases(prev => {
      const next = new Set(prev);
      if (next.has(phase)) next.delete(phase); else next.add(phase);
      return next;
    });
    setCurrentPage(1);
  }, []);

  const toggleParent = useCallback((parentId: number) => {
    setCollapsedParents(prev => {
      const next = new Set(prev);
      if (next.has(parentId)) next.delete(parentId); else next.add(parentId);
      return next;
    });
  }, []);

  const allCollapsed = collapsedPhases.size === phaseGroups.length && phaseGroups.length > 0;
  const allTableCollapsed = collapsedTablePhases.size === phaseGroups.length && phaseGroups.length > 0;

  // ─── allParentsCollapsed ──────────────────────────────────────────────────
  const parentActivityIds = useMemo(() =>
    activities.filter(a => !a.parent_id && activities.some(c => c.parent_id === a.id)).map(a => a.id),
  [activities]);

  const allParentsCollapsed = parentActivityIds.length > 0 && parentActivityIds.every(pid => collapsedParents.has(pid));

  // Default: collapse all phases and all epics on first load
  const initializedRef = useRef(false);
  useEffect(() => {
    if (activities.length > 0 && !initializedRef.current) {
      initializedRef.current = true;
      setCollapsedTablePhases(new Set(phaseGroups.map(g => g.phase)));
      setCollapsedParents(new Set(parentActivityIds));
    }
  }, [activities.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setCurrentPage(1); }, [filterPhase, rowsPerPage]);

  // ─── Children lookup map ──────────────────────────────────────────────────
  const childrenByParent = useMemo(() => {
    const map = new Map<number, Activity[]>();
    for (const a of activities) {
      if (a.parent_id) {
        if (!map.has(a.parent_id)) map.set(a.parent_id, []);
        map.get(a.parent_id)!.push(a);
      }
    }
    return map;
  }, [activities]);

  // ─── Pagination: paginate over parent-level rows ──────────────────────────
  const visibleParents = useMemo(() => {
    return phaseGroups.flatMap(({ phase, acts }) => {
      if (collapsedTablePhases.has(phase)) return [];
      return acts.filter(a => !a.parent_id);
    });
  }, [phaseGroups, collapsedTablePhases]);

  const totalTableRows = visibleParents.length;
  const totalTablePages = Math.max(1, Math.ceil(totalTableRows / rowsPerPage));

  const pagedParentIds = useMemo(() => {
    const slice = visibleParents.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);
    return new Set(slice.map(a => a.id));
  }, [visibleParents, currentPage, rowsPerPage]);

  // ─── Table row renderer ───────────────────────────────────────────────────
  const renderActivityRow = (row: Activity, isChild = false) => {
    const lag = calcLag(row.plan_end, row.actual_end, row.status);
    const isOverdue = lag > 0 && row.status !== 'Done';
    const children = childrenByParent.get(row.id) ?? [];
    const hasChildren = children.length > 0;
    const isParentCollapsed = collapsedParents.has(row.id);
    const progress = hasChildren ? weightedProgress(children.map(c => c.status)) : 0;

    return (
      <React.Fragment key={row.id}>
        <tr
          className={`border-t hover:bg-slate-50/60 transition-colors ${isOverdue ? 'bg-red-50/20' : ''}`}
          onContextMenu={e => {
            e.preventDefault();
            e.stopPropagation();
            setContextMenu({ x: e.clientX, y: e.clientY, activity: row });
          }}
        >
          {/* Key */}
          <td className="px-2 py-1.5 bg-teal-50/30" style={{ minWidth: '160px', paddingLeft: isChild ? 28 : undefined }}>
            {isChild && <span className="text-[9px] text-slate-300 mr-1">↳</span>}
            <input className="h-7 text-xs w-full border border-slate-200 rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 font-mono"
              value={row.jira_key ?? ''} onChange={e => updateField(row.id, 'jira_key', e.target.value)} onBlur={() => saveRow(row)} placeholder="KEY-1" />
          </td>
          {/* Activity — click text → detail; click empty space → inline edit */}
          <td
            className="px-2 py-1.5 cursor-text"
            style={{ minWidth: '280px' }}
            onClick={() => { if (editingActivityId !== row.id) setEditingActivityId(row.id); }}
          >
            <div className="flex items-center gap-1.5">
              {!isChild && hasChildren && (
                <button
                  onClick={e => { e.stopPropagation(); toggleParent(row.id); }}
                  className="shrink-0 w-4 h-4 flex items-center justify-center rounded hover:bg-slate-200 transition-colors"
                >
                  {isParentCollapsed ? <ChevronRight className="w-3 h-3 text-slate-400" /> : <ChevronDown className="w-3 h-3 text-slate-400" />}
                </button>
              )}
              {!isChild && !hasChildren && <span className="w-4 shrink-0" />}

              <div className="flex-1 min-w-0">
                {editingActivityId === row.id ? (
                  <input
                    autoFocus
                    className="w-full h-7 text-xs border border-blue-300 rounded px-1.5 bg-white outline-none focus:ring-1 focus:ring-blue-400"
                    value={row.activity}
                    onChange={e => updateField(row.id, 'activity', e.target.value)}
                    onBlur={() => {
                      const cur = activities.find(a => a.id === row.id);
                      if (cur) saveRow(cur);
                      setEditingActivityId(null);
                      if (newActivityIdRef.current === row.id) {
                        newActivityIdRef.current = null;
                        setDetailActivity(cur ?? row);
                      }
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const cur = activities.find(a => a.id === row.id);
                        if (cur) saveRow(cur);
                        setEditingActivityId(null);
                        if (newActivityIdRef.current === row.id) {
                          newActivityIdRef.current = null;
                          setDetailActivity(cur ?? row);
                        }
                      } else if (e.key === 'Escape') {
                        const cur = activities.find(a => a.id === row.id);
                        if (cur) saveRow(cur);
                        setEditingActivityId(null);
                        newActivityIdRef.current = null;
                      }
                    }}
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <div className="min-h-[28px] py-0.5">
                    <button
                      onClick={e => { e.stopPropagation(); setDetailActivity(row); }}
                      className="text-left inline group/detail"
                    >
                      <span className={`text-xs font-medium leading-snug transition-colors
                        group-hover/detail:text-blue-600 group-hover/detail:underline
                        ${isChild ? 'text-slate-600' : 'text-slate-700'}`}>
                        {row.activity || <span className="italic text-slate-400 no-underline">New Activity</span>}
                      </span>
                    </button>
                    {row.project_status && (
                      <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-px rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 font-medium mt-0.5 w-fit">
                        <Tag className="h-2 w-2 shrink-0" />{row.project_status}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {!isChild && hasChildren && (
                <span className="text-[9px] text-slate-400 shrink-0 tabular-nums" onClick={e => e.stopPropagation()}>
                  {children.length}
                </span>
              )}
            </div>
            {/* Weighted progress bar — shown only for parent rows with children */}
            {!isChild && hasChildren && (
              <div className="ml-5 mt-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: progressColor(progress) }} />
                  </div>
                  <span className="text-[9px] font-semibold tabular-nums w-7 text-right shrink-0" style={{ color: progressColor(progress) }}>{progress}%</span>
                </div>
              </div>
            )}
          </td>
          {/* Accountable */}
          <td className="px-2 py-1.5 w-36">
            <input list={`team-${id}`} className="h-7 text-xs w-full border border-slate-200 rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" value={row.accountable} onChange={e => updateField(row.id, 'accountable', e.target.value)} onBlur={() => saveRow(row)} placeholder="Chọn..." />
          </td>
          {/* Status */}
          <td className="px-2 py-1.5 w-36">
            <Select value={row.status} onValueChange={v => { const val = v ?? ''; updateField(row.id, 'status', val); saveRow({ ...row, status: val }); }}>
              <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </td>
        </tr>
        {/* Render children if parent not collapsed */}
        {!isChild && !isParentCollapsed && children.map(child => renderActivityRow(child, true))}
      </React.Fragment>
    );
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-4 lg:p-6 overflow-x-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800">Project Timeline</h1>
            {project?.status && (
              <span className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border ${PROJECT_STATUS_COLOR[project.status] ?? 'bg-slate-50 border-slate-200 text-slate-600'}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                {project.status}
              </span>
            )}
            {project?.current_phase && (
              <span className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full">
                <Tag className="h-3 w-3 text-slate-400" />
                Current: {project.current_phase}
              </span>
            )}
            {overdueCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                <AlertCircle className="h-3 w-3" /> {overdueCount} overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
              <button onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <LayoutList className="h-3.5 w-3.5" /> Table
              </button>
              <button onClick={() => setViewMode('roadmap')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'roadmap' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                <GanttChart className="h-3.5 w-3.5" /> Roadmap
              </button>
            </div>

            <Select value={filterPhase} onValueChange={v => setFilterPhase(v ?? 'All')}>
              <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Phases</SelectItem>
                {allPhases.filter(p => activities.some(a => a.phase === p)).map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button variant="outline" size="sm" onClick={() => setJiraSyncOpen(true)} className="gap-1.5 h-9">
              <RefreshCw className="h-3.5 w-3.5" /> Sync Jira
            </Button>

            {viewMode === 'table' && <>
              {phaseGroups.length > 1 && filterPhase === 'All' && (
                <button
                  onClick={() => setCollapsedTablePhases(allTableCollapsed ? new Set() : new Set(phaseGroups.map(g => g.phase)))}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 h-9 text-xs font-semibold rounded-lg transition-colors text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100">
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  {allTableCollapsed ? 'Expand Phases' : 'Collapse Phases'}
                </button>
              )}
              {parentActivityIds.length > 0 && (
                <button
                  onClick={() => setCollapsedParents(allParentsCollapsed ? new Set() : new Set(parentActivityIds))}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 h-9 text-xs font-semibold rounded-lg transition-colors text-violet-700 border border-violet-200 bg-violet-50 hover:bg-violet-100">
                  <ChevronsUpDown className="h-3.5 w-3.5" />
                  {allParentsCollapsed ? 'Expand Epics' : 'Collapse Epics'}
                </button>
              )}
              <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5 h-9">
                <FileDown className="h-3.5 w-3.5" /> Template
              </Button>
              <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5 h-9">
                <Upload className="h-3.5 w-3.5" /> Import
              </Button>
              <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5 h-9">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </>}

            {viewMode === 'roadmap' && <>
              {/* Plan/Actual/Both */}
              <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
                {([
                  { key: 'plan',   label: 'Plan',   active: 'bg-blue-600 text-white shadow-sm' },
                  { key: 'actual', label: 'Actual', active: 'bg-slate-700 text-white shadow-sm' },
                  { key: 'both',   label: 'Both',   active: 'bg-white text-slate-800 shadow-sm' },
                ] as { key: DateMode; label: string; active: string }[]).map(({ key, label, active }) => (
                  <button key={key} onClick={() => setDateMode(key)}
                    className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${dateMode === key ? active : 'text-slate-500 hover:text-slate-700'}`}>
                    {label}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setCollapsedPhases(allCollapsed ? new Set() : new Set(phaseGroups.map(g => g.phase)))}
                className="flex items-center gap-1.5 px-2.5 py-1.5 h-9 text-xs font-semibold rounded-lg transition-colors text-indigo-700 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100">
                <ChevronsUpDown className="h-3.5 w-3.5" />
                {allCollapsed ? 'Expand All' : 'Collapse All'}
              </button>

              <Select
                value={roadmapYear === null ? 'auto' : String(roadmapYear)}
                onValueChange={v => { setRoadmapYear(v === 'auto' ? null : Number(v)); if (v === 'auto') setRoadmapPeriod('all'); }}
              >
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto Range</SelectItem>
                  {dataYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>

              {roadmapYear !== null && (
                <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
                  {(['all', 'q1', 'q2', 'q3', 'q4'] as const).map(key => (
                    <button key={key} onClick={() => setRoadmapPeriod(key)}
                      className={`px-2.5 py-1.5 text-xs font-medium rounded-md transition-all ${roadmapPeriod === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                      {key === 'all' ? 'Year' : key.toUpperCase()}
                    </button>
                  ))}
                  <Select
                    value={roadmapPeriod.startsWith('m') ? roadmapPeriod : ''}
                    onValueChange={v => v && setRoadmapPeriod(v)}
                  >
                    <SelectTrigger className="h-7 text-xs border-0 bg-transparent px-2 w-[72px] focus:ring-0">
                      <SelectValue placeholder="Month" />
                    </SelectTrigger>
                    <SelectContent>
                      {MO_SHORT.map((m, i) => <SelectItem key={i} value={`m${i}`}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <Button variant="outline" size="sm" onClick={handleExportPng} className="gap-1.5 h-9 border-violet-200 text-violet-700 hover:bg-violet-50">
                <Download className="h-3.5 w-3.5" /> PNG
              </Button>
            </>}

            <Button
              variant="outline" size="sm"
              onClick={() => setHolidayOpen(true)}
              className={`gap-1.5 h-9 ${holidays.length ? 'border-orange-300 text-orange-700 hover:bg-orange-50' : ''}`}
            >
              <CalendarX2 className="h-3.5 w-3.5" />
              Holidays{holidays.length > 0 ? ` (${holidays.length})` : ''}
            </Button>

            <Button onClick={addActivity} className="bg-blue-600 hover:bg-blue-700 gap-2 h-9">
              <Plus className="h-4 w-4" /> Add Activity
            </Button>
          </div>
        </div>

        {viewMode === 'roadmap' && (
          <RoadmapView
            phaseGroups={phaseGroups}
            innerRef={roadmapRef}
            holidays={holidays}
            dateMode={dateMode}
            collapsedPhases={collapsedPhases}
            onTogglePhase={togglePhase}
            collapsedParents={collapsedParents}
            onToggleParent={toggleParent}
            onOpenDetail={setDetailActivity}
            viewYear={roadmapYear}
            viewPeriod={roadmapPeriod}
          />
        )}

        {/* Table */}
        {viewMode === 'table' && (
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}>
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-xs" style={{ minWidth: '700px' }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#1e293b] text-white">
                    <th className="px-2 py-3 text-left bg-teal-900/40" style={{ minWidth: '160px' }}>Key</th>
                    <th className="px-2 py-3 text-left" style={{ minWidth: '300px' }}>Activity</th>
                    <th className="px-2 py-3 text-left w-36">Accountable</th>
                    <th className="px-2 py-3 text-left w-36">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivities.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-16 text-slate-400">
                      <div className="flex flex-col items-center gap-3">
                        <p>Chưa có activity nào.</p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={handleDownloadTemplate} className="gap-1.5"><FileDown className="h-3.5 w-3.5" /> Template</Button>
                          <Button variant="outline" size="sm" onClick={() => setImportOpen(true)} className="gap-1.5"><Upload className="h-3.5 w-3.5" /> Import</Button>
                          <Button size="sm" onClick={addActivity} className="bg-blue-600 hover:bg-blue-700 gap-1.5"><Plus className="h-3.5 w-3.5" /> Add</Button>
                        </div>
                      </div>
                    </td></tr>
                  )}

                  {/* Phase grouped view */}
                  {phaseGroups.map(({ phase, acts }) => {
                    const style = getPhaseStyle(phase);
                    const isCollapsed = collapsedTablePhases.has(phase);
                    const parents = acts.filter(a => !a.parent_id);
                    const phaseLag = Math.max(0, ...acts.map(a => calcLag(a.plan_end, a.actual_end, a.status)));
                    const pageParents = isCollapsed ? [] : parents.filter(a => pagedParentIds.has(a.id));
                    if (!isCollapsed && parents.length > 0 && pageParents.length === 0) return null;

                    return (
                      <React.Fragment key={phase}>
                        {/* Phase header */}
                        {filterPhase === 'All' && (
                          <tr className={`border-t-2 border-slate-200 ${style.bg}`}>
                            <td colSpan={4} className={`px-3 py-2 ${style.text}`} style={{ borderLeft: `3px solid ${style.hex}80` }}>
                              <div className="flex items-center gap-2">
                                <button onClick={() => toggleTablePhase(phase)}
                                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-black/10 transition-colors shrink-0">
                                  {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </button>
                                <div className={`w-2 h-2 rounded-full ${style.bar} shrink-0`} />
                                <span className="text-xs font-bold uppercase tracking-wide">{phase}</span>
                                <span className="font-normal text-slate-400 text-[11px] shrink-0">({parents.length} activities)</span>
                                {phaseLag > 0 && <LagBadge lag={phaseLag} />}
                              </div>
                            </td>
                          </tr>
                        )}
                        {pageParents.map(row => renderActivityRow(row, false))}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="border-t px-4 py-2.5 flex items-center justify-between bg-white shrink-0 flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">
                  {totalTableRows > 0
                    ? `Showing ${Math.min((currentPage - 1) * rowsPerPage + 1, totalTableRows)}–${Math.min(currentPage * rowsPerPage, totalTableRows)} of ${totalTableRows} rows`
                    : '0 rows'}
                </span>
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <span>Rows per page:</span>
                  <select
                    value={rowsPerPage}
                    onChange={e => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                    className="h-7 text-xs border border-slate-200 rounded px-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  >
                    {[10, 20, 30, 50, 100].map(n => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>

              {totalTablePages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                    className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">«</button>
                  <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                    className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">‹</button>
                  {(() => {
                    const pages: (number | '...')[] = [];
                    if (totalTablePages <= 7) {
                      for (let i = 1; i <= totalTablePages; i++) pages.push(i);
                    } else {
                      pages.push(1);
                      if (currentPage > 3) pages.push('...');
                      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalTablePages - 1, currentPage + 1); i++) pages.push(i);
                      if (currentPage < totalTablePages - 2) pages.push('...');
                      pages.push(totalTablePages);
                    }
                    return pages.map((p, i) =>
                      p === '...'
                        ? <span key={`el-${i}`} className="px-2 py-1 text-xs text-slate-400">…</span>
                        : <button key={p} onClick={() => setCurrentPage(p as number)}
                            className={`px-2.5 py-1 text-xs rounded border transition-colors ${currentPage === p ? 'bg-blue-600 text-white border-blue-600' : 'border-slate-200 hover:bg-slate-50'}`}
                          >{p}</button>
                    );
                  })()}
                  <button onClick={() => setCurrentPage(p => Math.min(totalTablePages, p + 1))} disabled={currentPage === totalTablePages}
                    className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">›</button>
                  <button onClick={() => setCurrentPage(totalTablePages)} disabled={currentPage === totalTablePages}
                    className="px-2 py-1 text-xs rounded border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors">»</button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Status summary */}
        {viewMode === 'table' && filteredActivities.length > 0 && (
          <div className="flex gap-3 mt-3 flex-wrap">
            {STATUSES.map(s => {
              const count = filteredActivities.filter(a => a.status === s).length;
              if (!count) return null;
              return <Badge key={s} className={STATUS_COLOR[s]}>{s}: {count}</Badge>;
            })}
          </div>
        )}
      </main>

      <datalist id={`team-${id}`}>
        {teamMembers.map(m => <option key={m.id} value={m.name}>{m.role} — {m.domain}</option>)}
      </datalist>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-xl py-1 min-w-[168px]"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 180) }}
          onClick={e => e.stopPropagation()}
          onContextMenu={e => e.stopPropagation()}
        >
          <button
            onClick={() => { setDetailActivity(contextMenu.activity); setContextMenu(null); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Eye className="h-3.5 w-3.5 text-slate-400" /> View detail
          </button>
          <button
            onClick={() => { duplicateActivity(contextMenu.activity); setContextMenu(null); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Copy className="h-3.5 w-3.5 text-slate-400" /> Duplicate
          </button>
          {!contextMenu.activity.parent_id && (
            <button
              onClick={() => { createChild(contextMenu.activity.id); setContextMenu(null); }}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <FolderPlus className="h-3.5 w-3.5 text-slate-400" /> Create child
            </button>
          )}
          <div className="border-t border-slate-100 my-1" />
          <button
            onClick={() => { deleteRow(contextMenu.activity.id); setContextMenu(null); }}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </button>
        </div>
      )}

      {/* Holiday Dialog */}
      <Dialog open={holidayOpen} onOpenChange={setHolidayOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarX2 className="h-4 w-4 text-orange-500" /> Ngày nghỉ lễ dự án
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <p className="text-xs text-slate-500 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
              Thứ 7 và Chủ nhật được tự động cảnh báo. Thêm các ngày nghỉ lễ khác bên dưới.
            </p>
            <div className="flex gap-2">
              <input type="date" className="h-8 text-xs border border-slate-200 rounded-md px-2 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={newHDate} onChange={e => setNewHDate(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHoliday()} />
              <input className="h-8 text-xs border border-slate-200 rounded-md px-2 flex-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Tên ngày nghỉ..." value={newHName} onChange={e => setNewHName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addHoliday()} />
              <Button size="sm" className="h-8 bg-orange-500 hover:bg-orange-600 px-3" onClick={addHoliday} disabled={!newHDate}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
              {holidays.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-6">Chưa có ngày nghỉ lễ nào được thêm</p>
              )}
              {holidays.map(h => (
                <div key={h.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-orange-50 border border-orange-100">
                  <div className="text-xs font-mono text-orange-700 shrink-0 tabular-nums">{h.date}</div>
                  <div className="text-xs text-slate-600 flex-1 truncate">{h.name || <span className="text-slate-400 italic">—</span>}</div>
                  <button onClick={() => removeHoliday(h.id)} className="text-slate-300 hover:text-red-500 shrink-0 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHolidayOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Activity Detail Dialog (Jira-like) */}
      <Dialog open={!!detailActivity} onOpenChange={o => { if (!o) setDetailActivity(null); }}>
        <DialogContent showCloseButton={false} className="sm:max-w-7xl p-0 gap-0 overflow-hidden" style={{ maxWidth: 'min(98vw, 1400px)', maxHeight: '94vh' }}>
          {detailActivity && (
            <ActivityDetail
              key={detailActivity.id}
              activity={detailActivity}
              teamMembers={teamMembers}
              projectId={id}
              childActivities={childrenByParent.get(detailActivity.id) ?? []}
              onCreateChild={(name) => createChildFromDetail(detailActivity.id, name)}
              onViewChild={(child) => setDetailActivity(child)}
              onSave={updated => {
                setActivities(prev => prev.map(a => a.id === updated.id ? updated : a));
                setDetailActivity(null);
              }}
              onDelete={rowId => { deleteRow(rowId); setDetailActivity(null); }}
              onClose={() => setDetailActivity(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <ImportMappingDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={id}
        projectPhase={project?.current_phase ?? ''}
        onImported={load}
      />
      <JiraSyncDialog
        open={jiraSyncOpen}
        onOpenChange={setJiraSyncOpen}
        projectId={id}
        mode="timeline"
        onSynced={load}
      />
    </div>
  );
}
