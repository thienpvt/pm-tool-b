'use client';
import Link from 'next/link';
import { Building2, CalendarDays, ChevronDown, ChevronRight, Layers } from 'lucide-react';
import type { EpicDetailData, EpicNode, PhaseInfo, ProgramGroup, ProjectRow } from '../types';
import { PS, PHASES, RAG_COLOR } from './PhaseColours';
import { EPIC_PALETTE, epicStyle } from './EpicColours';
import { BAR_GAP, BAR_H, LABEL_W, MIN_M_W, ROW_PAD } from './helpers';

type Timeline = {
  months: { label: string; quarter: string; start: Date; end: Date }[];
  todayPct: number;
};

type Line =
  | { kind: 'phase'; ph: PhaseInfo }
  | { kind: 'epic'; ph: PhaseInfo; epic: EpicNode };

export type RoadmapPhaseGridProps = {
  groups: ProgramGroup[];
  tl: Timeline;
  selectedYear: number;
  openSet: Set<number>;
  expandedPhases: Set<string>;
  epicsByProject: Record<number, EpicNode[] | 'loading'>;
  roadmapRef: React.RefObject<HTMLDivElement | null>;
  rawPct: (dateStr: string, eod?: boolean) => number;
  onToggleProgram: (id: number) => void;
  onTogglePhaseExpand: (projectId: number, phase: string) => void;
  onEpicDetail: (detail: EpicDetailData) => void;
};

export function RoadmapPhaseGrid({
  groups, tl, selectedYear, openSet, expandedPhases, epicsByProject, roadmapRef,
  rawPct, onToggleProgram, onTogglePhaseExpand, onEpicDetail,
}: RoadmapPhaseGridProps) {
  return (
    <>
      <div className="shrink-0 px-6 py-2 bg-white border-b flex items-center gap-4 text-xs flex-wrap">
        <span className="font-semibold text-slate-600">Phase:</span>
        {PHASES.map(ph => {
          const s = PS[ph];
          return (
            <span
              key={ph}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md font-semibold text-[11px]"
              style={{ backgroundColor: s.bg, color: s.textColor, border: `1px solid ${s.border}` }}
            >
              <span className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: s.fill }} />
              {ph}
            </span>
          );
        })}
        <span className="text-slate-300 mx-1">|</span>
        <span className="text-slate-500">Bar fill = completion %</span>
        <span className="flex items-center gap-1.5 text-slate-500">
          <span className="flex items-center gap-0.5">
            {EPIC_PALETTE.slice(0, 4).map((e, i) => (
              <span key={i} className="w-2 h-2 rounded-sm inline-block" style={{ backgroundColor: e.fill, border: `1px solid ${e.border}` }} />
            ))}
          </span>
          <Layers className="h-3 w-3" /> Epic (màu riêng) — bấm phase để mở/đóng
        </span>
        <span className="flex items-center gap-1.5 text-slate-500">
          <span className="inline-block w-0.5 h-4 bg-blue-400 rounded" />Today
        </span>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div
          ref={roadmapRef}
          className="bg-white rounded-xl border shadow-sm overflow-hidden"
          style={{ minWidth: LABEL_W + tl.months.length * MIN_M_W }}
        >
          <div className="flex border-b bg-slate-50" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
            <div
              className="shrink-0 bg-slate-50 border-r flex items-end px-4 pb-2 pt-3"
              style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 30 }}
            >
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Program / Project</span>
            </div>
            <div className="flex flex-1">
              {tl.months.map((m, idx) => (
                <div
                  key={m.label}
                  className={`flex-1 border-r last:border-r-0 py-2 px-1 text-center ${idx % 3 === 0 ? 'bg-slate-100/60' : ''}`}
                  style={{ minWidth: MIN_M_W }}
                >
                  <p className="text-xs font-bold text-slate-600">{m.label}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5 font-medium">{m.quarter}</p>
                </div>
              ))}
            </div>
          </div>

          {groups.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-2 text-slate-300">
              <CalendarDays className="h-10 w-10" />
              <p className="text-sm">No projects found.</p>
              <Link href="/projects/new" className="text-sm text-blue-500 hover:underline mt-1">Create a project →</Link>
            </div>
          )}

          {groups.map(program => {
            const isOpen = openSet.has(program.id);
            return (
              <div key={program.id} className="border-b last:border-b-0">
                <button
                  onClick={() => onToggleProgram(program.id)}
                  className="w-full flex items-stretch border-b bg-slate-50/90 hover:bg-slate-100/80 transition-colors text-left"
                >
                  <div
                    className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-slate-50/90"
                    style={{ width: LABEL_W, minWidth: LABEL_W, position: 'sticky', left: 0, zIndex: 10 }}
                  >
                    {isOpen
                      ? <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      : <ChevronRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
                    <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <span className="text-xs font-bold text-slate-700 truncate">{program.name}</span>
                  </div>
                  <div className="flex-1 flex items-center gap-3 px-4 py-2.5 text-xs text-slate-400 flex-wrap">
                    <span>{program.projects.length} project{program.projects.length !== 1 ? 's' : ''}</span>
                    {PHASES.map(ph => {
                      const cnt = program.projects.filter(p => p.current_phase === ph).length;
                      if (!cnt) return null;
                      return (
                        <span
                          key={ph}
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                          style={{ backgroundColor: PS[ph].bg, color: PS[ph].textColor }}
                        >
                          {cnt} {ph}
                        </span>
                      );
                    })}
                  </div>
                </button>

                {isOpen && program.projects.map((project, pIdx) => {
                  const barsToShow = project.phases.filter(ph => {
                    if (!ph.start_date && !ph.end_date) return false;
                    const r0 = ph.start_date ? rawPct(ph.start_date) : -Infinity;
                    const r1 = ph.end_date ? rawPct(ph.end_date, true) : Infinity;
                    return r1 > 0 && r0 < 100;
                  });

                  const fallbackR0 = project.start_date ? rawPct(project.start_date) : -Infinity;
                  const fallbackR1 = project.end_date ? rawPct(project.end_date, true) : Infinity;
                  const showFallback = barsToShow.length === 0 &&
                    (project.start_date || project.end_date) &&
                    fallbackR1 > 0 && fallbackR0 < 100;

                  const projEpics = epicsByProject[project.id];
                  const lines: Line[] = [];
                  for (const ph of barsToShow) {
                    lines.push({ kind: 'phase', ph });
                    const expanded = expandedPhases.has(`${project.id}:${ph.phase}`);
                    if (expanded && Array.isArray(projEpics)) {
                      for (const epic of projEpics.filter(e => e.phase === ph.phase)) {
                        lines.push({ kind: 'epic', ph, epic });
                      }
                    }
                  }

                  const numBars = lines.length + (showFallback ? 1 : 0);
                  const rowH = Math.max(
                    (numBars || 1) * (BAR_H + BAR_GAP) + ROW_PAD * 2,
                    BAR_H + ROW_PAD * 2,
                  );

                  return (
                    <div
                      key={project.id}
                      className={`flex border-b last:border-b-0 ${pIdx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}
                    >
                      <div
                        className={`shrink-0 flex flex-col justify-center gap-0.5 px-4 border-r ${pIdx % 2 === 1 ? 'bg-slate-50/50' : 'bg-white'}`}
                        style={{ width: LABEL_W, minWidth: LABEL_W, minHeight: rowH, position: 'sticky', left: 0, zIndex: 10 }}
                      >
                        <Link href={`/projects/${project.id}`} className="group">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: RAG_COLOR[project.rag] }} />
                            <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-blue-600">{project.name}</span>
                          </div>
                        </Link>
                        {project.pm_name && <p className="text-[10px] text-slate-400 truncate pl-3">{project.pm_name}</p>}
                        <div className="pl-3">
                          <span
                            className="text-[9px] font-semibold px-1 py-0.5 rounded"
                            style={{
                              backgroundColor: PS[project.current_phase]?.bg ?? '#f1f5f9',
                              color: PS[project.current_phase]?.textColor ?? '#475569',
                            }}
                          >
                            {project.current_phase}
                          </span>
                        </div>
                      </div>

                      <div className="flex-1 relative overflow-hidden" style={{ height: rowH, minHeight: rowH }}>
                        <div className="absolute inset-0 flex pointer-events-none" aria-hidden>
                          {tl.months.map((m, idx) => (
                            <div
                              key={m.label}
                              className={`flex-1 border-r last:border-r-0 ${idx % 3 === 0 ? 'border-slate-200' : 'border-slate-100'}`}
                              style={{ minWidth: MIN_M_W }}
                            />
                          ))}
                        </div>

                        {tl.todayPct > 0 && tl.todayPct < 100 && (
                          <div
                            aria-hidden
                            className="absolute top-0 bottom-0 w-px pointer-events-none z-10"
                            style={{ left: `${tl.todayPct}%`, backgroundColor: '#60a5fa', opacity: 0.7 }}
                          />
                        )}

                        {lines.map((line, lineIdx) => {
                          const top = ROW_PAD + lineIdx * (BAR_H + BAR_GAP);

                          if (line.kind === 'phase') {
                            const ph = line.ph;
                            const s = PS[ph.phase] ?? PS['Execution'];
                            const r0 = ph.start_date ? rawPct(ph.start_date) : 0;
                            const r1 = ph.end_date ? rawPct(ph.end_date, true) : 100;
                            const startPct = Math.max(0, r0);
                            const endPct = Math.min(100, r1);
                            const widthPct = Math.max(endPct - startPct, 0.4);
                            const expanded = expandedPhases.has(`${project.id}:${ph.phase}`);

                            return (
                              <button
                                key={`ph-${ph.phase}`}
                                type="button"
                                onClick={() => onTogglePhaseExpand(project.id, ph.phase)}
                                className="absolute group text-left"
                                style={{ top, left: `${startPct}%`, width: `${widthPct}%`, height: BAR_H }}
                                title={`${ph.phase}: ${ph.done}/${ph.total} done · ${ph.completion_pct}% — bấm để xem Epic`}
                              >
                                <div
                                  className="relative h-full rounded-md overflow-hidden flex items-center shadow-sm transition-opacity hover:opacity-90"
                                  style={{ backgroundColor: s.bg, border: `1.5px solid ${s.border}` }}
                                >
                                  <div aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${ph.completion_pct}%`, backgroundColor: s.fill }} />
                                  <div className="relative z-10 flex items-center gap-1 px-1.5 min-w-0 w-full" style={{ color: s.textColor }}>
                                    {expanded ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                                    {ph.epic_key && (
                                      <span className="text-[9px] font-mono font-bold shrink-0 px-1 py-px rounded" style={{ backgroundColor: 'rgba(255,255,255,0.4)', letterSpacing: '0.02em' }}>
                                        {ph.epic_key}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-semibold truncate flex-1">{ph.phase}</span>
                                    <span className="text-[10px] shrink-0 opacity-80 ml-0.5">{ph.done}/{ph.total}</span>
                                    <span className="text-[10px] font-bold shrink-0 ml-0.5">{ph.completion_pct}%</span>
                                  </div>
                                </div>
                              </button>
                            );
                          }

                          const { epic, ph } = line;
                          const es = epicStyle(epic.id);
                          const e0 = epic.plan_start ? rawPct(epic.plan_start) : ph.start_date ? rawPct(ph.start_date) : 0;
                          const e1 = epic.plan_end ? rawPct(epic.plan_end, true) : ph.end_date ? rawPct(ph.end_date, true) : 100;
                          const startPct = Math.max(0, Math.min(100, e0));
                          const endPct = Math.max(0, Math.min(100, e1));
                          const widthPct = Math.max(endPct - startPct, 0.4);

                          return (
                            <button
                              key={`ep-${epic.id}`}
                              type="button"
                              onClick={() => onEpicDetail({
                                projectName: project.name,
                                epicActivity: epic.activity,
                                jira_key: epic.jira_key,
                                status: epic.status,
                                children: epic.children.map(c => ({
                                  id: c.id, jira_key: c.jira_key, no: c.no, activity: c.activity,
                                  status: c.status, plan_start: c.plan_start, plan_end: c.plan_end,
                                })),
                              })}
                              className="absolute group text-left"
                              style={{ top, left: `${startPct}%`, width: `${widthPct}%`, height: BAR_H }}
                              title={`Epic: ${epic.activity} · ${epic.weighted_pct}% (${epic.child_count} child) — bấm xem chi tiết`}
                            >
                              <div
                                className="relative h-full rounded-md overflow-hidden flex items-center shadow-sm transition-opacity hover:opacity-90"
                                style={{ backgroundColor: es.bg, border: `1.5px solid ${es.border}`, borderLeftWidth: 4 }}
                              >
                                <div aria-hidden className="absolute inset-y-0 left-0 opacity-65" style={{ width: `${epic.weighted_pct}%`, backgroundColor: es.fill }} />
                                <div className="relative z-10 flex items-center gap-1 px-1.5 min-w-0 w-full" style={{ color: es.textColor }}>
                                  <Layers className="h-2.5 w-2.5 shrink-0 opacity-70" />
                                  {epic.jira_key && (
                                    <span className="text-[9px] font-mono font-bold shrink-0 px-1 py-px rounded" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
                                      {epic.jira_key}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-medium truncate flex-1">{epic.activity}</span>
                                  <span className="text-[10px] font-bold shrink-0 ml-0.5">{epic.weighted_pct}%</span>
                                </div>
                              </div>
                            </button>
                          );
                        })}

                        {showFallback && (() => {
                          const s = PS[project.current_phase] ?? PS['Execution'];
                          const startPct = Math.max(0, fallbackR0);
                          const endPct = Math.min(100, fallbackR1);
                          const widthPct = Math.max(endPct - startPct, 0.4);
                          return (
                            <Link href={`/projects/${project.id}`} className="block">
                              <div className="absolute group cursor-pointer" style={{ top: ROW_PAD, left: `${startPct}%`, width: `${widthPct}%`, height: BAR_H }}>
                                <div
                                  className="relative h-full rounded-md overflow-hidden flex items-center shadow-sm transition-opacity hover:opacity-90"
                                  style={{ backgroundColor: s.bg, border: `1.5px solid ${s.border}` }}
                                  title={`${project.current_phase} · ${project.completion_pct}%`}
                                >
                                  <div aria-hidden className="absolute inset-y-0 left-0" style={{ width: `${project.completion_pct}%`, backgroundColor: s.fill }} />
                                  <div className="relative z-10 flex items-center gap-1 px-2 min-w-0 w-full" style={{ color: s.textColor }}>
                                    <span className="text-[10px] font-semibold truncate flex-1">{project.current_phase}</span>
                                    <span className="text-[10px] font-bold shrink-0 ml-0.5">{project.completion_pct}%</span>
                                  </div>
                                </div>
                              </div>
                            </Link>
                          );
                        })()}

                        {numBars === 0 && (
                          <div className="absolute inset-0 flex items-center px-4">
                            <span className="text-[10px] text-slate-300 italic">No activity in {selectedYear}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
