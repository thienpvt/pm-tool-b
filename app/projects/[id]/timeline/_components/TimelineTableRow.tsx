'use client';
import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronDown, ChevronRight, Tag } from 'lucide-react';
import { weightedProgress } from '@/lib/status-weights';
import type { Activity } from '../types';
import { STATUSES, PRIORITIES, PRIORITY_COLOR } from '../types';
import { calcLag } from './LagCalc';
import { progressColor } from './RoadmapHelpers';

export type TimelineTableRowProps = {
  row: Activity;
  isChild?: boolean;
  projectId: string;
  activities: Activity[];
  childrenByParent: Map<number, Activity[]>;
  collapsedParents: Set<number>;
  editingActivityId: number | null;
  newActivityIdRef: React.MutableRefObject<number | null>;
  updateField: (rowId: number, field: string, value: string | number) => void;
  saveRow: (row: Activity) => void;
  setEditingActivityId: (id: number | null) => void;
  setDetailActivity: (a: Activity) => void;
  setContextMenu: (m: { x: number; y: number; activity: Activity } | null) => void;
  toggleParent: (id: number) => void;
};

export function TimelineTableRow(props: TimelineTableRowProps) {
  const {
    row, isChild = false, projectId, activities, childrenByParent, collapsedParents,
    editingActivityId, newActivityIdRef, updateField, saveRow, setEditingActivityId,
    setDetailActivity, setContextMenu, toggleParent,
  } = props;
  const rowProps = props;
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
                      className="text-left inline group/detail w-full min-w-0"
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
          {/* Priority */}
          <td className="px-2 py-1.5 w-28">
            <Select value={row.priority || 'Medium'} onValueChange={v => { const val = v ?? 'Medium'; updateField(row.id, 'priority', val); saveRow({ ...row, priority: val }); }}>
              <SelectTrigger className={`h-7 text-[11px] font-semibold border ${PRIORITY_COLOR[row.priority] ?? PRIORITY_COLOR['Medium']}`}><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </td>
          {/* Accountable */}
          <td className="px-2 py-1.5 w-36">
            <input list={`team-${projectId}`} className="h-7 text-xs w-full border border-slate-200 rounded-md px-2 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" value={row.accountable} onChange={e => updateField(row.id, 'accountable', e.target.value)} onBlur={() => saveRow(row)} placeholder="Chọn..." />
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
        {!isChild && !isParentCollapsed && children.map(child => (
          <TimelineTableRow key={child.id} {...rowProps} row={child} isChild />
        ))}
      </React.Fragment>
    );
}
