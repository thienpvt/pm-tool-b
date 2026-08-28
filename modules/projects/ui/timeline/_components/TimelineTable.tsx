'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Upload, FileDown, ChevronDown, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { Activity } from '../types';
import { STATUSES, STATUS_COLOR, getPhaseStyle } from '../types';
import { calcLag, LagBadge } from './LagCalc';
import { TimelineTableRow, type TimelineTableRowProps } from './TimelineTableRow';

export type TimelineTableProps = Omit<TimelineTableRowProps, 'row' | 'isChild'> & {
  filterPhase: string;
  phaseGroups: { phase: string; acts: Activity[] }[];
  collapsedTablePhases: Set<string>;
  toggleTablePhase: (phase: string) => void;
  pagedParentIds: Set<number>;
  filteredActivities: Activity[];
  totalTableRows: number;
  totalTablePages: number;
  currentPage: number;
  rowsPerPage: number;
  setCurrentPage: (p: number | ((prev: number) => number)) => void;
  setRowsPerPage: (n: number) => void;
  handleDownloadTemplate: () => void;
  setImportOpen: (v: boolean) => void;
  addActivity: () => void;
};

export function TimelineTable({
  filterPhase, phaseGroups, collapsedTablePhases, toggleTablePhase, pagedParentIds,
  filteredActivities, totalTableRows, totalTablePages, currentPage, rowsPerPage,
  setCurrentPage, setRowsPerPage, handleDownloadTemplate, setImportOpen, addActivity,
  ...rowProps
}: TimelineTableProps) {
  return (
    <>
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 200px)', minHeight: '400px' }}>
            <div className="overflow-auto flex-1 min-h-0">
              <table className="w-full text-xs" style={{ minWidth: '700px' }}>
                <thead className="sticky top-0 z-10">
                  <tr className="bg-[#1e293b] text-white">
                    <th className="px-2 py-3 text-left bg-teal-900/40" style={{ minWidth: '160px' }}>Key</th>
                    <th className="px-2 py-3 text-left" style={{ minWidth: '300px' }}>Activity</th>
                    <th className="px-2 py-3 text-left w-28">Priority</th>
                    <th className="px-2 py-3 text-left w-36">Accountable</th>
                    <th className="px-2 py-3 text-left w-36">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredActivities.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-16 text-slate-400">
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
                            <td colSpan={5} className={`px-3 py-2 ${style.text}`} style={{ borderLeft: `3px solid ${style.hex}80` }}>
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
                        {pageParents.map(row => <TimelineTableRow {...rowProps} row={row} />)}
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

      {filteredActivities.length > 0 && (
        <div className="flex gap-3 mt-3 flex-wrap">
          {STATUSES.map(s => {
            const count = filteredActivities.filter(a => a.status === s).length;
            if (!count) return null;
            return <Badge key={s} className={STATUS_COLOR[s]}>{s}: {count}</Badge>;
          })}
        </div>
      )}
    </>
  );
}
