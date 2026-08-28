import Link from 'next/link';
import { Calendar, User, Building2, ShieldAlert, Bug } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ProjectRow } from '../types';
import { PHASE_COLOR } from './helpers';
import { RagBadge } from './RagBadge';

export function ListRow({ p }: { p: ProjectRow }) {
  const dl = p.days_until_deadline;
  const isOverdue = dl !== null && dl < 0;
  const isWarning = dl !== null && dl >= 0 && dl <= 14;
  return (
    <Link href={`/projects/${p.id}`}>
      <div className={`flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-b last:border-0 cursor-pointer group ${isOverdue ? 'bg-red-50/30' : ''}`}>
        <div className="w-16 shrink-0"><RagBadge rag={p.rag} /></div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-slate-800 truncate group-hover:text-blue-700">{p.name}</p>
          {(p.program_name || p.client) && (
            <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
              <Building2 className="h-2.5 w-2.5" />{p.program_name || p.client}
            </p>
          )}
        </div>
        <div className="w-24 shrink-0 hidden md:block">
          <Badge className={`text-[10px] ${PHASE_COLOR[p.current_phase] ?? 'bg-slate-100 text-slate-600'}`}>{p.current_phase}</Badge>
        </div>
        <div className="w-28 shrink-0 hidden lg:block">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
              <div className={`h-full rounded-full ${p.completion_pct >= 80 ? 'bg-green-500' : p.completion_pct >= 40 ? 'bg-blue-400' : 'bg-slate-300'}`} style={{ width: `${p.completion_pct}%` }} />
            </div>
            <span className="text-[11px] text-slate-500 font-medium shrink-0">{p.completion_pct}%</span>
          </div>
          <p className="text-[10px] text-slate-300 mt-0.5">{p.done_activities}/{p.total_activities} done</p>
        </div>
        <div className="w-28 shrink-0 hidden xl:flex flex-col items-end">
          {dl !== null ? (
            <span className={`text-xs font-semibold flex items-center gap-1 ${isOverdue ? 'text-red-600' : isWarning ? 'text-amber-500' : 'text-slate-400'}`}>
              <Calendar className="h-3 w-3" />
              {isOverdue ? `${Math.abs(dl)}d overdue` : `${dl}d left`}
            </span>
          ) : <span className="text-xs text-slate-300">—</span>}
          {p.end_date && <span className="text-[10px] text-slate-300">{p.end_date}</span>}
        </div>
        <div className="w-16 shrink-0 flex flex-col items-end gap-0.5">
          {p.open_risks > 0 && <span className="flex items-center gap-1 text-[10px] text-red-500"><ShieldAlert className="h-3 w-3" />{p.open_risks}</span>}
          {p.open_issues > 0 && <span className="flex items-center gap-1 text-[10px] text-violet-500"><Bug className="h-3 w-3" />{p.open_issues}</span>}
          {p.open_risks === 0 && p.open_issues === 0 && <span className="text-[10px] text-green-500">✓</span>}
        </div>
        {p.pm_name && (
          <div className="w-24 shrink-0 hidden xl:flex items-center gap-1">
            <User className="h-3 w-3 text-slate-300" />
            <span className="text-[11px] text-slate-400 truncate">{p.pm_name}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
