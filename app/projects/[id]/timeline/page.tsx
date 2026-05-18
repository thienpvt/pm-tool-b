'use client';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Save, Download, Upload, FileDown, AlertCircle, MessageSquare, GanttChart, LayoutList, CalendarX2 } from 'lucide-react';
import ImportMappingDialog from '@/components/timeline/ImportMappingDialog';

type Activity = {
  id: number; phase: string; no: string; activity: string; deliverable: string;
  sign_off_doc: string; accountable: string; responsible: string; support: string;
  plan_start: string; plan_end: string; actual_start: string; actual_end: string;
  status: string; completion_pct: number; notes: string; order_idx: number;
  delay_owner: string; delay_reason: string;
  jira_key: string; sprint: string;
};

type TeamMember = { id: number; name: string; role: string; domain: string; };
type Holiday   = { id: number; project_id: number; date: string; name: string; };

const DEFAULT_PHASES = ['Initializing', 'Architecture & Design', 'Setup & Infra', 'Development', 'Testing', 'UAT', 'Deployment', 'Closing'];
const STATUSES = ['To-do', 'In Progress', 'Done', 'Blocked', 'Deferred'];
const DELAY_OWNERS = ['N/A', 'Client', 'Vendor', 'Both', 'External'];

const STATUS_COLOR: Record<string, string> = {
  'To-do': 'bg-slate-100 text-slate-600',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Done': 'bg-green-100 text-green-700',
  'Blocked': 'bg-red-100 text-red-700',
  'Deferred': 'bg-orange-100 text-orange-700',
};

const PHASE_STYLE: Record<string, { bg: string; text: string; bar: string }> = {
  'Initializing':          { bg: 'bg-blue-50',   text: 'text-blue-900',   bar: 'bg-blue-500' },
  'Architecture & Design': { bg: 'bg-indigo-50',  text: 'text-indigo-900', bar: 'bg-indigo-500' },
  'Setup & Infra':         { bg: 'bg-cyan-50',    text: 'text-cyan-900',   bar: 'bg-cyan-500' },
  'Development':           { bg: 'bg-violet-50',  text: 'text-violet-900', bar: 'bg-violet-500' },
  'Testing':               { bg: 'bg-amber-50',   text: 'text-amber-900',  bar: 'bg-amber-500' },
  'UAT':                   { bg: 'bg-orange-50',  text: 'text-orange-900', bar: 'bg-orange-500' },
  'Deployment':            { bg: 'bg-emerald-50', text: 'text-emerald-900',bar: 'bg-emerald-500' },
  'Closing':               { bg: 'bg-slate-100',  text: 'text-slate-700',  bar: 'bg-slate-500' },
};

function getPhaseStyle(phase: string) {
  return PHASE_STYLE[phase] ?? { bg: 'bg-gray-50', text: 'text-gray-800', bar: 'bg-gray-400' };
}

// ─── Lag calculation ──────────────────────────────────────────────────────────
function calcLag(planEnd: string, actualEnd: string, status: string): number {
  if (!planEnd) return 0;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const plan = new Date(planEnd); plan.setHours(0, 0, 0, 0);

  if (status === 'Done') {
    if (!actualEnd) return 0;
    const actual = new Date(actualEnd); actual.setHours(0, 0, 0, 0);
    return Math.round((actual.getTime() - plan.getTime()) / 86400000);
  }
  if (status === 'To-do') return 0; // not started, ignore
  // In Progress / Blocked / Deferred — accumulating delay
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

// No, Phase, Key, Activity, Deliverable, Sign-off, Accountable, Responsible, Support, PlanStart, PlanEnd, ActualStart, ActualEnd, Status, Pct, Sprint, DelayOwner, DelayReason, Notes
const TEMPLATE_ROWS = [
  ['1', 'Initializing', 'PROJ-1', 'Project Kickoff', 'Kickoff Presentation', 'Signed Charter', 'PM', 'PM', '', '2025-01-06', '2025-01-06', '2025-01-06', '2025-01-08', 'Done', '100', '', 'Vendor', 'Internal prep took longer', ''],
  ['2', 'Development',  'PROJ-2', 'Backend API',     'API Module',           'Test Report',    'Tech Lead', 'BE Team', 'SA', '2025-02-01', '2025-03-31', '2025-02-05', '', 'In Progress', '60', 'Sprint 1', 'Client', 'Waiting for client API spec', ''],
  ['3', 'Testing',      'PROJ-3', 'SIT',             'SIT Report',           'SIT Sign-off',   'QA Lead', 'QA Team', 'Dev', '2025-04-01', '2025-04-15', '', '', 'To-do', '0', '', 'N/A', '', ''],
];

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = []; let cur = ''; let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { if (inQuote && line[i+1] === '"') { cur += '"'; i++; } else inQuote = !inQuote; }
      else if (ch === ',' && !inQuote) { cells.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  return rows;
}

// ─── Roadmap ──────────────────────────────────────────────────────────────────
const MO_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MO_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function rd(s?: string | null): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

const BAR_PALETTE: Record<string, { ghost: string; border: string; fill: string }> = {
  'Initializing':          { ghost: '#eff6ff', border: '#93c5fd', fill: '#3b82f6' },
  'Architecture & Design': { ghost: '#eef2ff', border: '#a5b4fc', fill: '#6366f1' },
  'Setup & Infra':         { ghost: '#ecfeff', border: '#67e8f9', fill: '#06b6d4' },
  'Development':           { ghost: '#f5f3ff', border: '#c4b5fd', fill: '#8b5cf6' },
  'Testing':               { ghost: '#fffbeb', border: '#fcd34d', fill: '#f59e0b' },
  'UAT':                   { ghost: '#fff7ed', border: '#fdba74', fill: '#f97316' },
  'Deployment':            { ghost: '#ecfdf5', border: '#6ee7b7', fill: '#10b981' },
  'Closing':               { ghost: '#f8fafc', border: '#cbd5e1', fill: '#64748b' },
};
function barPalette(phase: string) {
  return BAR_PALETTE[phase] ?? { ghost: '#f8fafc', border: '#e2e8f0', fill: '#94a3b8' };
}

// ─── DateCell: date input with weekend / holiday warning ─────────────────────
function DateCell({ value, onChange, onBlur, warn, extraClass = '' }: {
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  warn: string | null;
  extraClass?: string;
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
        <div
          title={warn}
          className="absolute -top-1.5 -right-1.5 z-20 w-4 h-4 rounded-full bg-orange-500
            flex items-center justify-center cursor-help shadow"
        >
          <span className="text-white font-bold leading-none" style={{ fontSize: 9 }}>!</span>
        </div>
      )}
    </div>
  );
}

// ─── RoadmapView ──────────────────────────────────────────────────────────────
function RoadmapView({
  phaseGroups,
  innerRef,
  holidays,
}: {
  phaseGroups: { phase: string; acts: Activity[] }[];
  innerRef: React.RefObject<HTMLDivElement | null>;
  holidays: Holiday[];
}) {
  const allMs: number[] = [];
  for (const { acts } of phaseGroups)
    for (const a of acts) {
      const s = rd(a.plan_start), e = rd(a.plan_end);
      if (s) allMs.push(s.getTime());
      if (e) allMs.push(e.getTime());
    }

  if (!allMs.length) {
    return (
      <div className="rounded-xl border bg-white py-20 text-center text-slate-400 shadow-sm">
        <GanttChart className="h-12 w-12 mx-auto mb-3 opacity-15" />
        <p className="text-sm font-semibold">Chưa có dữ liệu để hiển thị Roadmap</p>
        <p className="text-xs mt-1">Điền Plan Start và Plan End cho các activity trước.</p>
      </div>
    );
  }

  const minMs = Math.min(...allMs), maxMs = Math.max(...allMs);
  const rangeStart = new Date(new Date(minMs).getFullYear(), new Date(minMs).getMonth(), 1);
  const rangeEnd   = new Date(new Date(maxMs).getFullYear(), new Date(maxMs).getMonth() + 1, 0);

  const totalDays = Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / 86_400_000) + 1;
  const ppd = Math.max(3, Math.min(32, Math.round(1100 / totalDays)));
  const totalW = totalDays * ppd;
  const weekW  = 7 * ppd; // nominal week width
  const showWeekLabel = weekW >= 18; // only label W1-W4 if wide enough

  // ── Month + week structure ───────────────────────────────────────────────
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
        { label: 'W1', d0: 1,  d1: 7 },
        { label: 'W2', d0: 8,  d1: 14 },
        { label: 'W3', d0: 15, d1: 21 },
        { label: 'W4', d0: 22, d1: lastDay },
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

  // year groups
  const yearGroups: { year: number; w: number }[] = [];
  for (const m of months) {
    if (yearGroups.length && yearGroups[yearGroups.length - 1].year === m.year)
      yearGroups[yearGroups.length - 1].w += m.totalW;
    else yearGroups.push({ year: m.year, w: m.totalW });
  }

  // ── Today ────────────────────────────────────────────────────────────────
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayX = Math.round((today.getTime() - rangeStart.getTime()) / 86_400_000) * ppd;
  const showToday = todayX > 0 && todayX < totalW;

  // ── Weekend bands (Saturday+Sunday pairs) ────────────────────────────────
  const weekendBands: { x: number; w: number }[] = [];
  {
    const d = new Date(rangeStart);
    const dow = d.getDay();
    d.setDate(d.getDate() + ((6 - dow + 7) % 7)); // advance to first Saturday
    while (d <= rangeEnd) {
      const sx = Math.round((d.getTime() - rangeStart.getTime()) / 86_400_000) * ppd;
      const bw = Math.min(2 * ppd, totalW - sx);
      if (bw > 0) weekendBands.push({ x: sx, w: bw });
      d.setDate(d.getDate() + 7);
    }
  }

  // ── Holiday markers ───────────────────────────────────────────────────────
  const holidayMarkers: { x: number; name: string }[] = holidays
    .map(h => ({ d: rd(h.date), name: h.name }))
    .filter(h => h.d !== null)
    .map(h => ({ x: Math.round((h.d!.getTime() - rangeStart.getTime()) / 86_400_000) * ppd, name: h.name }))
    .filter(h => h.x >= 0 && h.x < totalW);

  // ── Bar helpers ───────────────────────────────────────────────────────────
  function pBar(a: Activity) {
    const s = rd(a.plan_start), e = rd(a.plan_end);
    if (!s || !e) return null;
    const lx = Math.round((s.getTime() - rangeStart.getTime()) / 86_400_000) * ppd;
    const w  = Math.max(ppd, (Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1) * ppd);
    return { lx, w };
  }
  function aBar(a: Activity) {
    const s = rd(a.actual_start);
    if (!s) return null;
    const e = rd(a.actual_end) ?? today;
    const lx = Math.round((s.getTime() - rangeStart.getTime()) / 86_400_000) * ppd;
    const w  = Math.max(ppd, (Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1) * ppd);
    return { lx, w };
  }
  function fillCol(a: Activity, base: string) {
    if (a.status === 'Done')     return '#22c55e';
    if (a.status === 'Blocked')  return '#ef4444';
    if (a.status === 'Deferred') return '#94a3b8';
    return base;
  }

  const LEFT = 256, ROW = 46;
  const HDR = (multiYear ? 22 : 0) + 26 + 22; // year? + month + week rows
  const totalBodyH = phaseGroups.reduce((h, { acts }) => h + 30 + acts.length * ROW, 0);

  return (
    <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <div ref={innerRef} style={{ minWidth: LEFT + totalW + 24, background: '#fff' }}>

          {/* ── Header ── */}
          <div style={{ display: 'flex', background: '#0f172a', height: HDR }}>
            {/* corner */}
            <div style={{ width: LEFT, flexShrink: 0, borderRight: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'flex-end', padding: '0 16px 8px' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em' }}>ACTIVITY</span>
            </div>
            <div style={{ flex: 1, position: 'relative' }}>
              {/* year row */}
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
              {/* month row */}
              <div style={{ position: 'absolute', top: multiYear ? 22 : 0, left: 0, right: 0, height: 26, display: 'flex',
                borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
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
              {/* week row */}
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 22, display: 'flex' }}>
                {months.map(m =>
                  m.weeks.map((wk, wi) => (
                    <div key={`${m.year}-${m.label}-${wi}`} style={{ width: wk.w, flexShrink: 0,
                      borderRight: wi === m.weeks.length - 1
                        ? '1.5px solid rgba(255,255,255,0.18)'
                        : '1px solid rgba(255,255,255,0.06)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {showWeekLabel && (
                        <span style={{ fontSize: 9, color: '#64748b', fontWeight: 500 }}>{wk.label}</span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* ── Body ── */}
          <div style={{ position: 'relative' }}>
            {/* weekend shading layer */}
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

            {phaseGroups.map(({ phase, acts }) => {
              const pSt = getPhaseStyle(phase);
              const pal = barPalette(phase);
              return (
                <React.Fragment key={phase}>
                  {/* phase header */}
                  <div className={`flex border-b ${pSt.bg}`} style={{ height: 30, position: 'relative', zIndex: 1 }}>
                    <div className={`flex items-center gap-2 px-4 border-r border-slate-200 shrink-0 ${pSt.text}`} style={{ width: LEFT }}>
                      <div className={`w-2 h-2 rounded-full shrink-0 ${pSt.bar}`} />
                      <span className="text-[11px] font-bold uppercase tracking-widest">{phase}</span>
                      <span className="text-[10px] font-normal opacity-50">({acts.length})</span>
                    </div>
                    <div className="relative flex-1">
                      {/* week grid lines */}
                      {months.map(m => m.weeks.map((wk, wi) => (
                        <div key={`${m.label}-${wi}`} className="absolute inset-y-0"
                          style={{ left: wk.sx, borderRight: wi === m.weeks.length - 1 ? '1.5px solid rgba(100,116,139,0.25)' : '1px solid rgba(100,116,139,0.10)' }} />
                      )))}
                      {showToday && <div className="absolute inset-y-0 w-px" style={{ left: todayX, background: '#f87171', opacity: 0.4 }} />}
                    </div>
                  </div>

                  {/* activity rows */}
                  {acts.map((a, ri) => {
                    const pb = pBar(a), ab = aBar(a);
                    const lag = calcLag(a.plan_end, a.actual_end, a.status);
                    const overdue = lag > 0 && a.status !== 'Done';
                    const fc = fillCol(a, pal.fill);
                    const barShift = ab ? 'translateY(calc(-50% - 3px))' : 'translateY(-50%)';

                    return (
                      <div key={a.id}
                        className={`flex border-b transition-colors hover:bg-blue-50/30
                          ${overdue ? '!bg-red-50/50' : ri % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
                        style={{ height: ROW, position: 'relative', zIndex: 1 }}>

                        {/* left panel */}
                        <div className="flex items-center gap-2 px-4 border-r border-slate-100 shrink-0 bg-inherit" style={{ width: LEFT }}>
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-semibold text-slate-700 truncate leading-tight">{a.activity || '—'}</p>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className={`text-[9px] px-1.5 py-px rounded-sm font-bold ${STATUS_COLOR[a.status] ?? 'bg-slate-100 text-slate-500'}`}>{a.status}</span>
                              {overdue && <span className="text-[9px] font-bold text-red-500">+{lag}d</span>}
                              {a.accountable && <span className="text-[9px] text-slate-400 truncate max-w-[80px]">{a.accountable}</span>}
                            </div>
                          </div>
                          {a.completion_pct > 0 && (
                            <span className="text-[11px] font-bold text-slate-400 shrink-0 tabular-nums">{a.completion_pct}%</span>
                          )}
                        </div>

                        {/* bar area */}
                        <div className="relative flex-1" style={{ height: ROW }}>
                          {/* week grid lines */}
                          {months.map(m => m.weeks.map((wk, wi) => (
                            <div key={`${m.label}-${wi}`} className="absolute inset-y-0"
                              style={{ left: wk.sx, borderRight: wi === m.weeks.length - 1 ? '1.5px solid rgba(100,116,139,0.12)' : '1px solid rgba(100,116,139,0.06)' }} />
                          )))}

                          {/* today */}
                          {showToday && (
                            <div className="absolute inset-y-0 z-10" style={{ left: todayX }}>
                              <div className="w-px h-full" style={{ background: '#f87171', opacity: 0.7 }} />
                            </div>
                          )}

                          {/* ghost plan bar */}
                          {pb && (
                            <div style={{
                              position: 'absolute', left: pb.lx, width: pb.w, height: 18,
                              top: '50%', transform: barShift,
                              background: pal.ghost, border: `1.5px solid ${pal.border}`, borderRadius: 9999,
                            }} />
                          )}
                          {/* progress fill */}
                          {pb && a.completion_pct > 0 && (
                            <div style={{
                              position: 'absolute', left: pb.lx,
                              width: Math.round(pb.w * a.completion_pct / 100), height: 18,
                              top: '50%', transform: barShift,
                              background: fc, opacity: 0.88, borderRadius: 9999,
                            }} />
                          )}
                          {/* % label */}
                          {pb && pb.w >= 38 && a.completion_pct > 0 && (
                            <div style={{
                              position: 'absolute', left: pb.lx + 5, top: '50%', transform: barShift,
                              fontSize: 9, fontWeight: 700, color: a.completion_pct > 28 ? '#fff' : pal.fill,
                              lineHeight: '18px', zIndex: 20, pointerEvents: 'none',
                            }}>{a.completion_pct}%</div>
                          )}
                          {/* actual bar */}
                          {ab && (
                            <div style={{
                              position: 'absolute', left: ab.lx, width: ab.w, height: 4,
                              top: '50%', transform: 'translateY(7px)',
                              background: '#475569', opacity: 0.4, borderRadius: 9999,
                            }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>

          {/* today footer label */}
          {showToday && (
            <div className="relative border-t bg-slate-50" style={{ height: 22 }}>
              <div className="absolute inset-y-0 w-px bg-red-400/50" style={{ left: LEFT + todayX }} />
              <div className="absolute bottom-1" style={{ left: LEFT + todayX + 3 }}>
                <span className="text-[9px] font-bold text-red-500 bg-white border border-red-200 rounded px-1 py-px whitespace-nowrap">Today</span>
              </div>
            </div>
          )}

          {/* legend */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 border-t bg-slate-50/70">
            {([
              ['Plan range',    <div key="a" style={{ width:28, height:14, background:'#eff6ff', border:'1.5px solid #93c5fd', borderRadius:9999 }} />],
              ['Progress',      <div key="b" style={{ width:28, height:14, background:'#3b82f6', borderRadius:9999, opacity:.85 }} />],
              ['Done',          <div key="c" style={{ width:28, height:14, background:'#22c55e', borderRadius:9999, opacity:.85 }} />],
              ['Blocked',       <div key="d" style={{ width:28, height:14, background:'#ef4444', borderRadius:9999, opacity:.85 }} />],
              ['Actual period', <div key="e" style={{ width:28, height:4, background:'#475569', borderRadius:9999, opacity:.4 }} />],
              ['Weekend',       <div key="f" style={{ width:14, height:14, background:'rgba(0,0,0,0.06)', borderRadius:2 }} />],
              ['Holiday',       <div key="g" style={{ width:14, height:14, background:'rgba(249,115,22,0.15)', borderTop:'3px solid #f97316', borderRadius:2 }} />],
              ['Today',         <div key="h" style={{ width:2, height:14, background:'#f87171', opacity:.7 }} />],
            ] as [string, React.ReactNode][]).map(([label, el]) => (
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
  const [filterPhase, setFilterPhase] = useState('All');
  const [saving, setSaving] = useState<number | null>(null);

  const [importOpen, setImportOpen] = useState(false);

  const [delayEdit, setDelayEdit] = useState<{ row: Activity; reason: string } | null>(null);
  const [viewMode, setViewMode] = useState<'table' | 'roadmap'>('table');
  const roadmapRef = useRef<HTMLDivElement>(null);

  // ── Holidays ────────────────────────────────────────────────────────────────
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [holidayOpen, setHolidayOpen] = useState(false);
  const [newHDate, setNewHDate] = useState('');
  const [newHName, setNewHName] = useState('');
  const holidaySet = useMemo(() => new Set(holidays.map(h => h.date)), [holidays]);

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
      a.download = 'roadmap.png';
      a.href = dataUrl;
      a.click();
      toast.success('Exported roadmap.png');
    } catch {
      toast.error('Export PNG thất bại');
    }
  };

  const load = useCallback(() => {
    fetch(`/api/projects/${id}/activities`).then(r => r.json()).then(setActivities);
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch(`/api/projects/${id}/team`).then(r => r.json()).then(setTeamMembers); }, [id]);
  useEffect(() => { fetch(`/api/projects/${id}/holidays`).then(r => r.json()).then(setHolidays); }, [id]);

  const addActivity = async () => {
    const uniquePhases = [...new Set(activities.map(a => a.phase).filter(Boolean))];
    const phase = filterPhase === 'All'
      ? (uniquePhases[0] ?? DEFAULT_PHASES[0])
      : filterPhase;
    const res = await fetch(`/api/projects/${id}/activities`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase, activity: 'New Activity', jira_key: '', sprint: '' }),
    });
    const row = await res.json();
    setActivities(a => [...a, row]);
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

  // Dynamic phases from data (preserving insertion order)
  const allPhases = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const a of activities) {
      if (a.phase && !seen.has(a.phase)) { seen.add(a.phase); result.push(a.phase); }
    }
    // Append default phases not yet in data
    for (const p of DEFAULT_PHASES) {
      if (!seen.has(p)) result.push(p);
    }
    return result;
  }, [activities]);

  // Grouped display
  const baseList = filterPhase === 'All' ? activities : activities.filter(a => a.phase === filterPhase);
  const phaseGroups: { phase: string; acts: Activity[] }[] = [];
  const seenPhases = new Set<string>();
  for (const a of baseList) {
    if (!seenPhases.has(a.phase)) {
      seenPhases.add(a.phase);
      phaseGroups.push({ phase: a.phase, acts: baseList.filter(x => x.phase === a.phase) });
    }
  }
  const showGroups = filterPhase === 'All';

  // Overdue count for banner
  const overdueCount = activities.filter(a => a.status !== 'Done' && calcLag(a.plan_end, a.actual_end, a.status) > 0).length;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-4 lg:p-6 overflow-x-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-800">Project Timeline</h1>
            {overdueCount > 0 && (
              <span className="flex items-center gap-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
                <AlertCircle className="h-3 w-3" /> {overdueCount} overdue
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* View toggle */}
            <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'table' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <LayoutList className="h-3.5 w-3.5" /> Table
              </button>
              <button
                onClick={() => setViewMode('roadmap')}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                  viewMode === 'roadmap' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                <GanttChart className="h-3.5 w-3.5" /> Roadmap
              </button>
            </div>

            <Select value={filterPhase} onValueChange={v => setFilterPhase(v ?? 'All')}>
              <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All Phases</SelectItem>
                {allPhases.filter(p => activities.some(a => a.phase === p)).map(p => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {viewMode === 'table' && <>
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

            {viewMode === 'roadmap' && (
              <Button variant="outline" size="sm" onClick={handleExportPng} className="gap-1.5 h-9 border-violet-200 text-violet-700 hover:bg-violet-50">
                <Download className="h-3.5 w-3.5" /> Export PNG
              </Button>
            )}

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

        {viewMode === 'roadmap' ? (
          <RoadmapView phaseGroups={phaseGroups} innerRef={roadmapRef} holidays={holidays} />
        ) : null}

        {/* Table */}
        {viewMode === 'table' && <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: '1800px' }}>
              <thead>
                <tr className="bg-[#1e293b] text-white">
                  {showGroups && <th className="px-2 py-3 text-left w-32">Phase</th>}
                  <th className="px-2 py-3 text-left w-24 bg-teal-900/40">Key</th>
                  <th className="px-2 py-3 text-left" style={{ minWidth: '200px' }}>Activity</th>
                  <th className="px-2 py-3 text-left w-36">Deliverable</th>
                  <th className="px-2 py-3 text-left w-28">Accountable</th>
                  <th className="px-2 py-3 text-left w-28">Responsible</th>
                  <th className="px-2 py-3 text-left w-24">Plan Start</th>
                  <th className="px-2 py-3 text-left w-24">Plan End</th>
                  <th className="px-2 py-3 text-left w-24">Actual Start</th>
                  <th className="px-2 py-3 text-left w-24">Actual End</th>
                  <th className="px-2 py-3 text-left w-24">Status</th>
                  <th className="px-2 py-3 text-center w-10">%</th>
                  <th className="px-2 py-3 text-center w-16 bg-red-900/30">Lag</th>
                  <th className="px-2 py-3 text-left w-24 bg-red-900/30">Delay By</th>
                  <th className="px-2 py-3 text-left w-36 bg-red-900/30">Delay Reason</th>
                  <th className="px-2 py-3 text-left w-28 bg-teal-900/40">Sprint</th>
                  <th className="px-2 py-3 text-left w-28">Notes</th>
                  <th className="px-2 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {baseList.length === 0 && (
                  <tr><td colSpan={showGroups ? 18 : 17} className="text-center py-16 text-slate-400">
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

                {phaseGroups.map(({ phase, acts }) => {
                  const style = getPhaseStyle(phase);
                  const phaseLag = Math.max(0, ...acts.map(a => calcLag(a.plan_end, a.actual_end, a.status)));
                  return (
                    <React.Fragment key={phase}>
                      {showGroups && (
                        <tr key={`ph-${phase}`}>
                          <td colSpan={18} className={`px-4 py-2 font-bold text-xs uppercase tracking-widest border-t-2 border-slate-200 ${style.bg} ${style.text}`}>
                            <div className="flex items-center gap-3">
                              <div className={`w-2 h-2 rounded-full ${style.bar}`} />
                              {phase}
                              <span className="font-normal text-slate-400 normal-case tracking-normal text-[11px]">({acts.length} activities)</span>
                              {phaseLag > 0 && <LagBadge lag={phaseLag} />}
                            </div>
                          </td>
                        </tr>
                      )}
                      {acts.map(row => {
                        const lag = calcLag(row.plan_end, row.actual_end, row.status);
                        const isOverdue = lag > 0 && row.status !== 'Done';
                        return (
                          <tr key={row.id} className={`border-t hover:bg-slate-50/60 transition-colors ${isOverdue ? 'bg-red-50/20' : ''}`}>
                            {showGroups && (
                              <td className="px-2 py-1.5">
                                <input
                                  list={`phases-${id}`}
                                  className="h-7 text-xs w-full border border-slate-200 rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                                  value={row.phase}
                                  onChange={e => updateField(row.id, 'phase', e.target.value)}
                                  onBlur={() => saveRow(row)}
                                />
                              </td>
                            )}
                            <td className="px-2 py-1.5 bg-teal-50/30">
                              <input
                                className="h-7 text-xs w-full border border-slate-200 rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-teal-400 font-mono"
                                value={row.jira_key ?? ''}
                                onChange={e => updateField(row.id, 'jira_key', e.target.value)}
                                onBlur={() => saveRow(row)}
                                placeholder="KEY-1"
                              />
                            </td>
                            <td className="px-2 py-1.5" style={{ minWidth: '200px' }}>
                              <textarea className="text-xs w-full min-h-[48px] px-2 py-1 border border-slate-200 rounded-md resize-y bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 leading-snug" value={row.activity} onChange={e => updateField(row.id, 'activity', e.target.value)} onBlur={() => saveRow(row)} />
                            </td>
                            <td className="px-2 py-1.5">
                              <textarea className="text-xs w-full min-h-[48px] px-2 py-1 border border-slate-200 rounded-md resize-y bg-white focus:outline-none focus:ring-1 focus:ring-blue-400 leading-snug" value={row.deliverable} onChange={e => updateField(row.id, 'deliverable', e.target.value)} onBlur={() => saveRow(row)} />
                            </td>
                            <td className="px-2 py-1.5">
                              <input list={`team-${id}`} className="h-7 text-xs w-full border border-slate-200 rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" value={row.accountable} onChange={e => updateField(row.id, 'accountable', e.target.value)} onBlur={() => saveRow(row)} placeholder="Chọn..." />
                            </td>
                            <td className="px-2 py-1.5">
                              <input list={`team-${id}`} className="h-7 text-xs w-full border border-slate-200 rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" value={row.responsible} onChange={e => updateField(row.id, 'responsible', e.target.value)} onBlur={() => saveRow(row)} placeholder="Chọn..." />
                            </td>
                            <td className="px-2 py-1.5">
                              <DateCell value={row.plan_start} warn={getDateWarn(row.plan_start)}
                                onChange={v => updateField(row.id, 'plan_start', v)} onBlur={() => saveRow(row)} />
                            </td>
                            <td className="px-2 py-1.5">
                              <DateCell value={row.plan_end} warn={getDateWarn(row.plan_end)}
                                onChange={v => updateField(row.id, 'plan_end', v)} onBlur={() => saveRow(row)}
                                extraClass={isOverdue ? 'border-red-300' : ''} />
                            </td>
                            <td className="px-2 py-1.5">
                              <DateCell value={row.actual_start} warn={getDateWarn(row.actual_start)}
                                onChange={v => updateField(row.id, 'actual_start', v)} onBlur={() => saveRow(row)} />
                            </td>
                            <td className="px-2 py-1.5">
                              <DateCell value={row.actual_end} warn={getDateWarn(row.actual_end)}
                                onChange={v => updateField(row.id, 'actual_end', v)} onBlur={() => saveRow(row)} />
                            </td>
                            <td className="px-2 py-1.5">
                              <Select value={row.status} onValueChange={v => { const val = v ?? ''; updateField(row.id, 'status', val); saveRow({ ...row, status: val }); }}>
                                <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                            </td>
                            <td className="px-2 py-1.5 text-center">
                              <Input className="h-7 text-xs w-12 px-1 text-center mx-auto" type="number" min={0} max={100} value={row.completion_pct} onChange={e => updateField(row.id, 'completion_pct', Number(e.target.value))} onBlur={() => saveRow(row)} />
                            </td>
                            {/* Lag */}
                            <td className="px-2 py-1.5 text-center bg-slate-50/50">
                              <LagBadge lag={lag} />
                            </td>
                            {/* Delay Owner */}
                            <td className="px-2 py-1.5 bg-slate-50/50">
                              <Select value={row.delay_owner || 'N/A'} onValueChange={v => { const val = v ?? 'N/A'; updateField(row.id, 'delay_owner', val); saveRow({ ...row, delay_owner: val }); }}>
                                <SelectTrigger className={`h-7 text-xs ${row.delay_owner && row.delay_owner !== 'N/A' ? DELAY_OWNER_COLOR[row.delay_owner] : ''}`}><SelectValue /></SelectTrigger>
                                <SelectContent>{DELAY_OWNERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                              </Select>
                            </td>
                            {/* Delay Reason */}
                            <td className="px-2 py-1.5 bg-slate-50/50">
                              <button
                                onClick={() => setDelayEdit({ row, reason: row.delay_reason || '' })}
                                className={`w-full h-7 text-left text-xs px-2 rounded border transition-colors truncate ${row.delay_reason ? 'border-slate-200 text-slate-700 hover:border-blue-400 hover:bg-blue-50' : 'border-dashed border-slate-200 text-slate-400 hover:border-blue-400 hover:text-blue-500'}`}
                              >
                                {row.delay_reason
                                  ? <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3 shrink-0" /><span className="truncate">{row.delay_reason}</span></span>
                                  : 'Add reason...'}
                              </button>
                            </td>
                            <td className="px-2 py-1.5 bg-teal-50/30">
                              <Input
                                className="h-7 text-xs bg-white"
                                value={row.sprint ?? ''}
                                onChange={e => updateField(row.id, 'sprint', e.target.value)}
                                onBlur={() => saveRow(row)}
                                placeholder="Sprint name..."
                              />
                            </td>
                            <td className="px-2 py-1.5">
                              <Input className="h-7 text-xs" value={row.notes} onChange={e => updateField(row.id, 'notes', e.target.value)} onBlur={() => saveRow(row)} />
                            </td>
                            <td className="px-2 py-1.5">
                              <div className="flex items-center gap-1">
                                {saving === row.id && <Save className="h-3 w-3 text-blue-400 animate-pulse" />}
                                <button onClick={() => deleteRow(row.id)} className="text-slate-300 hover:text-red-500">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>}

        {/* Status summary */}
        {viewMode === 'table' && baseList.length > 0 && (
          <div className="flex gap-3 mt-3 flex-wrap">
            {STATUSES.map(s => {
              const count = baseList.filter(a => a.status === s).length;
              if (!count) return null;
              return <Badge key={s} className={STATUS_COLOR[s]}>{s}: {count}</Badge>;
            })}
          </div>
        )}
      </main>

      {/* Datalists */}
      <datalist id={`team-${id}`}>
        {teamMembers.map(m => <option key={m.id} value={m.name}>{m.role} — {m.domain}</option>)}
      </datalist>
      <datalist id={`phases-${id}`}>
        {allPhases.map(p => <option key={p} value={p} />)}
      </datalist>

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
              Thứ 7 và Chủ nhật được tự động cảnh báo. Thêm các ngày nghỉ lễ khác bên dưới — Plan Start / Plan End rơi vào ngày nghỉ sẽ hiện cảnh báo <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-orange-500 text-white font-bold" style={{fontSize:9}}>!</span>
            </p>

            {/* Add form */}
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

            {/* List */}
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

      {/* Delay Reason Dialog */}
      <Dialog open={!!delayEdit} onOpenChange={o => { if (!o) setDelayEdit(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-orange-500" /> Delay Reason
            </DialogTitle>
          </DialogHeader>
          {delayEdit && (
            <div className="space-y-3 py-1">
              <div className="text-xs text-slate-500 bg-slate-50 rounded px-3 py-2 border border-slate-200">
                <span className="font-medium text-slate-700">Activity:</span> {delayEdit.row.activity}
              </div>
              <div>
                <Label className="text-xs text-slate-600 mb-1.5 block">Mô tả lý do delay</Label>
                <textarea
                  className="w-full text-sm border border-slate-200 rounded-md px-3 py-2 min-h-[120px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Nhập lý do delay chi tiết..."
                  autoFocus
                  value={delayEdit.reason}
                  onChange={e => setDelayEdit(prev => prev ? { ...prev, reason: e.target.value } : null)}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDelayEdit(null)}>Hủy</Button>
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                if (!delayEdit) return;
                const updated = { ...delayEdit.row, delay_reason: delayEdit.reason };
                updateField(delayEdit.row.id, 'delay_reason', delayEdit.reason);
                saveRow(updated);
                setDelayEdit(null);
              }}
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ImportMappingDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={id}
        onImported={load}
      />
    </div>
  );
}
