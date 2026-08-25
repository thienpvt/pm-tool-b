'use client';
import { BarChart2 } from 'lucide-react';
import type { ProjectReportData } from '../types';
import { fmtDate } from './helpers';

export type ReportHeaderKpiProps = { data: ProjectReportData | null };

export function ReportHeaderKpi({ data }: ReportHeaderKpiProps) {
  return (
    <>
      <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <BarChart2 className="h-5 w-5 text-violet-600 shrink-0" />
          <div className="min-w-0">
            <h1 className="font-semibold text-slate-900 text-sm truncate">
              Project Status Report{data ? ` — ${data.project.name}` : ''}
            </h1>
            {data && (
              <p className="text-xs text-slate-500 mt-0.5">
                {data.project.current_phase} · PM: {data.project.pm_name ?? 'N/A'} ·{' '}
                {data.project.end_date ? `End: ${fmtDate(data.project.end_date)}` : 'No deadline'}
                {data.project.days_until_deadline !== null && (
                  <span className={data.project.days_until_deadline < 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>
                    {' '}({data.project.days_until_deadline < 0
                      ? `OVERDUE ${Math.abs(data.project.days_until_deadline)}d`
                      : `${data.project.days_until_deadline}d left`})
                  </span>
                )}
              </p>
            )}
          </div>
        </div>
        {data && (
          <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            data.project.rag === 'red' ? 'bg-red-100 text-red-700' :
            data.project.rag === 'amber' ? 'bg-amber-100 text-amber-700' :
            'bg-green-100 text-green-700'}`}>
            ● {data.project.rag === 'red' ? 'ĐỎ' : data.project.rag === 'amber' ? 'VÀNG' : 'XANH'}
          </span>
        )}
      </div>
      {data && (
        <div className="bg-white border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 shrink-0">
          {[
            { label: 'Total Activities', value: data.stats.total, sub: `${data.stats.inProgress} in progress`, color: 'text-slate-900' },
            { label: 'Completion', value: `${data.stats.completion_pct}%`, sub: `${data.stats.done} done`, color: data.stats.completion_pct >= 70 ? 'text-green-600' : data.stats.completion_pct >= 40 ? 'text-amber-600' : 'text-red-600' },
            { label: 'Open Risks', value: data.openRisks.length, sub: `${data.openRisks.filter(r=>r.priority==='Critical').length} critical`, color: data.openRisks.length > 0 ? 'text-red-600' : 'text-green-600' },
            { label: 'Open Issues', value: data.openIssues.length, sub: `${data.epicStats.length} epics/phases`, color: data.openIssues.length > 0 ? 'text-amber-600' : 'text-green-600' },
          ].map(k => (
            <div key={k.label} className="px-5 py-3">
              <div className={`text-2xl font-bold leading-none ${k.color}`}>{k.value}</div>
              <div className="text-xs text-slate-500 mt-1">{k.label}</div>
              <div className="text-xs text-slate-400 mt-0.5">{k.sub}</div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
