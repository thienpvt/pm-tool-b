import Link from 'next/link';
import {
  ShieldAlert, Bug, TrendingUp, AlertCircle, CheckCircle2, Clock, Zap, Target, ChevronRight,
} from 'lucide-react';
import type { ProjectRow } from '../types';
import { PHASE_COLOR } from './helpers';
import { RagBadge } from './RagBadge';

type Analytics = {
  red: number;
  totalOpenRisks: number;
  avgCompletion: number;
  total: number;
  topRiskyProjects: ProjectRow[];
};

type Props = { analytics: Analytics };

export function RecommendationsRow({ analytics }: Props) {
  if (analytics.topRiskyProjects.length === 0 && analytics.total === 0) return null;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Needs Attention</h3>
            <p className="text-[11px] text-slate-400">Projects requiring immediate action</p>
          </div>
          <AlertCircle className="h-4 w-4 text-red-400" />
        </div>
        {analytics.topRiskyProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2">
            <CheckCircle2 className="h-8 w-8 text-green-400" />
            <p className="text-sm text-slate-400">All projects are on track</p>
          </div>
        ) : (
          <div className="space-y-2">
            {analytics.topRiskyProjects.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <div className="flex items-center gap-3 p-3 rounded-xl border hover:border-blue-200 hover:bg-blue-50/30 transition-colors cursor-pointer group">
                  <RagBadge rag={p.rag} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-blue-700">{p.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                      <span className={`${PHASE_COLOR[p.current_phase] ?? ''} px-1.5 rounded text-[9px]`}>{p.current_phase}</span>
                      {p.open_risks > 0 && <span className="text-red-400 flex items-center gap-0.5"><ShieldAlert className="h-2.5 w-2.5" />{p.open_risks}R</span>}
                      {p.open_issues > 0 && <span className="text-violet-400 flex items-center gap-0.5"><Bug className="h-2.5 w-2.5" />{p.open_issues}I</span>}
                      {p.days_until_deadline !== null && p.days_until_deadline < 0 && (
                        <span className="text-red-500 flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{Math.abs(p.days_until_deadline)}d overdue</span>
                      )}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-bold text-slate-700">{p.completion_pct}%</p>
                    <p className="text-[10px] text-slate-400">done</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Top Recommendations</h3>
            <p className="text-[11px] text-slate-400">Data-driven action items</p>
          </div>
          <Zap className="h-4 w-4 text-amber-400" />
        </div>
        <div className="space-y-3">
          {analytics.red > 0 && (
            <div className="flex gap-3 p-3 rounded-xl bg-red-50 border border-red-100">
              <div className="w-7 h-7 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
                <ShieldAlert className="h-3.5 w-3.5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-red-800">Address critical projects</p>
                <p className="text-[11px] text-red-600 mt-0.5">{analytics.red} project{analytics.red > 1 ? 's are' : ' is'} in RED status. Immediate escalation recommended.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-red-300 shrink-0 self-center" />
            </div>
          )}
          {analytics.totalOpenRisks > 3 && (
            <div className="flex gap-3 p-3 rounded-xl bg-orange-50 border border-orange-100">
              <div className="w-7 h-7 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
                <AlertCircle className="h-3.5 w-3.5 text-orange-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-orange-800">Reduce open risks</p>
                <p className="text-[11px] text-orange-600 mt-0.5">{analytics.totalOpenRisks} risks are unresolved. Review mitigation plans with project teams.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-orange-300 shrink-0 self-center" />
            </div>
          )}
          {analytics.avgCompletion < 50 && analytics.total > 0 && (
            <div className="flex gap-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <TrendingUp className="h-3.5 w-3.5 text-amber-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-amber-800">Accelerate delivery</p>
                <p className="text-[11px] text-amber-600 mt-0.5">Portfolio avg. completion is {analytics.avgCompletion}%. Identify blockers slowing teams down.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-amber-300 shrink-0 self-center" />
            </div>
          )}
          {analytics.red === 0 && analytics.totalOpenRisks <= 3 && analytics.avgCompletion >= 50 && (
            <div className="flex gap-3 p-3 rounded-xl bg-green-50 border border-green-100">
              <div className="w-7 h-7 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-green-800">Portfolio is healthy</p>
                <p className="text-[11px] text-green-600 mt-0.5">No critical issues detected. Keep monitoring progress and risks proactively.</p>
              </div>
            </div>
          )}
          <Link href="/portfolio/report">
            <div className="flex gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors cursor-pointer">
              <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Target className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-semibold text-blue-800">Generate AI portfolio report</p>
                <p className="text-[11px] text-blue-600 mt-0.5">Get an executive summary with insights and action items powered by Claude.</p>
              </div>
              <ChevronRight className="h-4 w-4 text-blue-300 shrink-0 self-center" />
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}
