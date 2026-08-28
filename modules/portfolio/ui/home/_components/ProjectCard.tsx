import Link from 'next/link';
import { Calendar, User, ShieldAlert, Bug, ArrowRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ProjectRow } from '../types';
import { PHASE_COLOR, daysLeft } from './helpers';

export function ProjectCard({ p }: { p: ProjectRow }) {
  const dl = daysLeft(p.end_date);
  const isOverdue = dl !== null && dl < 0;
  const isWarning = dl !== null && dl >= 0 && dl <= 14;
  return (
    <Link href={`/projects/${p.id}`}>
      <div className="bg-white rounded-xl border hover:shadow-md transition-all cursor-pointer group p-4 flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2">
          <Badge className={`text-[10px] shrink-0 ${PHASE_COLOR[p.current_phase] ?? 'bg-slate-100 text-slate-600'}`}>{p.current_phase}</Badge>
          <ArrowRight className="h-3.5 w-3.5 text-slate-200 group-hover:text-blue-500 transition-colors shrink-0 mt-0.5" />
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 text-sm leading-snug line-clamp-2">{p.name}</h4>
          {p.pm_name && <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><User className="h-3 w-3" />{p.pm_name}</p>}
        </div>
        <div>
          <div className="flex justify-between text-[10px] text-slate-400 mb-1">
            <span>{p.done_activities}/{p.total_activities} activities</span>
            <span className="font-semibold text-slate-600">{p.completion_pct}%</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${p.completion_pct >= 80 ? 'bg-green-500' : p.completion_pct >= 40 ? 'bg-blue-500' : 'bg-slate-300'}`} style={{ width: `${p.completion_pct}%` }} />
          </div>
        </div>
        <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t">
          <div className="flex items-center gap-3">
            {p.open_risks > 0 && <span className="flex items-center gap-1 text-red-500"><ShieldAlert className="h-3 w-3" />{p.open_risks}</span>}
            {p.open_issues > 0 && <span className="flex items-center gap-1 text-violet-500"><Bug className="h-3 w-3" />{p.open_issues}</span>}
            {p.open_risks === 0 && p.open_issues === 0 && <span className="text-green-500">✓ Clean</span>}
          </div>
          {dl !== null && (
            <span className={`flex items-center gap-1 font-medium ${isOverdue ? 'text-red-500' : isWarning ? 'text-amber-500' : 'text-slate-400'}`}>
              <Calendar className="h-3 w-3" />
              {isOverdue ? `${Math.abs(dl)}d overdue` : `${dl}d left`}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
