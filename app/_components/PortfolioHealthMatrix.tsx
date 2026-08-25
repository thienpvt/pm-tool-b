import Link from 'next/link';
import { TrendingUp, User, ChevronRight } from 'lucide-react';
import type { ProjectRow } from '../types';
import { PHASE_COLOR } from './helpers';
import { RagBadge } from './RagBadge';

type Props = { projects: ProjectRow[] };

export function PortfolioHealthMatrix({ projects }: Props) {
  if (projects.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-300" />
          Portfolio Health Matrix
        </h2>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-600 text-slate-200 font-medium">
          {projects.length} projects
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-100">
              <th className="px-4 py-2.5 text-left w-8">#</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5 text-left">Project</th>
              <th className="px-4 py-2.5 text-left">Program</th>
              <th className="px-4 py-2.5 text-left">Phase</th>
              <th className="px-4 py-2.5 text-left w-32">Progress</th>
              <th className="px-4 py-2.5 text-left">Deadline</th>
              <th className="px-4 py-2.5 text-left">PM</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {[...projects]
              .sort((a, b) => {
                const o: Record<string, number> = { red: 0, amber: 1, green: 2 };
                return o[a.rag] - o[b.rag];
              })
              .map((p, i) => {
                const dl = p.days_until_deadline;
                const isOverdue = dl !== null && dl < 0;
                const isWarning = dl !== null && dl >= 0 && dl <= 14;
                return (
                  <tr key={p.id} className={`hover:bg-slate-50 transition-colors ${p.rag === 'red' ? 'bg-red-50/30' : p.rag === 'amber' ? 'bg-amber-50/20' : ''}`}>
                    <td className="px-4 py-2.5 text-xs text-slate-400">{i + 1}</td>
                    <td className="px-4 py-2.5"><RagBadge rag={p.rag} /></td>
                    <td className="px-4 py-2.5">
                      <Link href={`/projects/${p.id}`} className="font-medium text-slate-800 hover:text-blue-600 flex items-center gap-1 group text-sm">
                        {p.name}
                        <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-blue-400 transition-colors" />
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{p.program_name || p.client || '—'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PHASE_COLOR[p.current_phase] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {p.current_phase}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[60px]">
                          <div className={`h-full rounded-full ${Number(p.completion_pct) >= 70 ? 'bg-green-500' : Number(p.completion_pct) >= 40 ? 'bg-blue-500' : 'bg-amber-400'}`} style={{ width: `${p.completion_pct}%` }} />
                        </div>
                        <span className="text-xs font-medium text-slate-600 w-8 text-right">{p.completion_pct}%</span>
                      </div>
                      {Number(p.total_activities) > 0 && (
                        <div className="text-[10px] text-slate-400 mt-0.5">{p.done_activities}/{p.total_activities} done</div>
                      )}
                    </td>
                    <td className={`px-4 py-2.5 text-xs ${isOverdue ? 'text-red-600 font-semibold' : isWarning ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                      {dl === null ? '—' : isOverdue ? `${Math.abs(dl)}d overdue` : `${dl}d left`}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3 text-slate-300" />
                        {p.pm_name || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
