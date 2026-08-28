import { ShieldAlert, Bug, TrendingUp, AlertCircle } from 'lucide-react';
import { HealthScoreArc } from './HealthScoreArc';
import { MiniSparkline } from './MiniSparkline';

type Analytics = {
  healthScore: number;
  red: number;
  amber: number;
  green: number;
  total: number;
  totalOpenRisks: number;
  totalOpenIssues: number;
  avgCompletion: number;
  overdueCount: number;
  doneActivities: number;
  totalActivities: number;
};

type Props = {
  analytics: Analytics;
  riskSpark: number[];
  issueSpark: number[];
  progSpark: number[];
};

export function KpiCardsRow({ analytics, riskSpark, issueSpark, progSpark }: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <div className="bg-white rounded-2xl border p-5 flex flex-col items-center gap-2 shadow-sm">
        <div className="w-full flex items-center justify-between mb-1">
          <span className="text-sm font-bold text-slate-700">Overall Health Score</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Workspace</span>
        </div>
        <HealthScoreArc score={analytics.healthScore} />
        <p className="text-xs text-slate-400 text-center">
          {analytics.green} healthy · {analytics.amber} at risk · {analytics.red} critical
        </p>
      </div>

      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-slate-700">Projects at Risk</p>
            <p className="text-[11px] text-slate-400">RED + AMBER status</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
            <ShieldAlert className="h-4 w-4 text-red-500" />
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-4xl font-bold text-slate-900">{analytics.red + analytics.amber}</p>
            <p className="text-xs text-slate-400 mt-1">of {analytics.total} projects</p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <MiniSparkline data={riskSpark} color="#ef4444" />
            {analytics.red > 0
              ? <span className="text-[10px] text-red-500 font-semibold">{analytics.red} critical</span>
              : <span className="text-[10px] text-green-500 font-semibold">None critical</span>}
          </div>
        </div>
        {analytics.overdueCount > 0 && (
          <div className="mt-3 flex items-center gap-1.5 text-[11px] text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {analytics.overdueCount} project{analytics.overdueCount > 1 ? 's' : ''} overdue
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-slate-700">Open Issues & Risks</p>
            <p className="text-[11px] text-slate-400">Across all projects</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center">
            <Bug className="h-4 w-4 text-orange-500" />
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-4xl font-bold text-slate-900">{analytics.totalOpenRisks + analytics.totalOpenIssues}</p>
            <p className="text-xs text-slate-400 mt-1">
              {analytics.totalOpenRisks} risks · {analytics.totalOpenIssues} issues
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <MiniSparkline data={issueSpark} color="#f97316" />
            <span className={`text-[10px] font-semibold ${analytics.totalOpenRisks + analytics.totalOpenIssues > 5 ? 'text-orange-500' : 'text-green-500'}`}>
              {analytics.totalOpenRisks + analytics.totalOpenIssues > 5 ? 'High impact' : 'Under control'}
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-sm font-bold text-slate-700">Avg. Progress</p>
            <p className="text-[11px] text-slate-400">Portfolio completion</p>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
        </div>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-4xl font-bold text-slate-900">{analytics.avgCompletion}%</p>
            <p className="text-xs text-slate-400 mt-1">
              {analytics.doneActivities}/{analytics.totalActivities} activities done
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <MiniSparkline data={progSpark} color="#3b82f6" />
            <span className={`text-[10px] font-semibold ${analytics.avgCompletion >= 60 ? 'text-blue-500' : 'text-amber-500'}`}>
              {analytics.avgCompletion >= 60 ? 'On track' : 'Needs attention'}
            </span>
          </div>
        </div>
        <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${analytics.avgCompletion}%` }} />
        </div>
      </div>
    </div>
  );
}
