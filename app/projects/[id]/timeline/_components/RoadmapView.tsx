'use client';
import React from 'react';
import { GanttChart, ChevronDown, ChevronRight } from 'lucide-react';
import { weightedProgress } from '@/lib/status-weights';
import type { Activity, Holiday, DateMode } from '../types';
import { DONE_STATUSES, getPhaseStyle, STATUS_COLOR, PRIORITY_COLOR } from '../types';
import { calcLag } from './LagCalc';
import { fmtD, statusBar, progressColor } from './RoadmapHelpers';
import { computeRoadmapLayout } from './RoadmapLayout';

export function RoadmapView({
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
  const computed = computeRoadmapLayout(
    phaseGroups, holidays, dateMode, viewYear, viewPeriod, collapsedPhases, collapsedParents,
  );

  if (computed.empty) {
    return (
      <div className="rounded-xl border bg-white py-20 text-center text-slate-400 shadow-sm">
        <GanttChart className="h-12 w-12 mx-auto mb-3 opacity-15" />
        <p className="text-sm font-semibold">Chưa có dữ liệu để hiển thị Roadmap</p>
        <p className="text-xs mt-1">{computed.emptyLabel}</p>
      </div>
    );
  }

  const {
    totalW, ppd, showWeekLabel, months, multiYear, yearGroups, todayX, showToday,
    weekendBands, holidayMarkers, pBar, aBar, ROW, LEFT, HDR, totalBodyH,
  } = computed.layout;

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
                              {/* Line 2: status + priority + mini progress (epics) + collapsed count */}
                              <div className="flex items-center gap-1 mt-0.5 min-w-0">
                                <span className={`text-[9px] px-1 py-px rounded font-bold shrink-0 ${STATUS_COLOR[a.status] ?? 'bg-slate-100 text-slate-500'}`}>{a.status}</span>
                                {a.priority && a.priority !== 'Medium' && (
                                  <span className={`text-[8px] px-1 py-px rounded font-bold shrink-0 border ${PRIORITY_COLOR[a.priority] ?? 'bg-slate-100 text-slate-400 border-slate-200'}`}>{a.priority}</span>
                                )}
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
