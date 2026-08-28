import Link from 'next/link';
import { Activity, CheckCircle2, ChevronRight } from 'lucide-react';
import {
  BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';
import type { ProjectRow } from '../types';
import { avatarBg, initials, healthLabel, healthBarColor } from './helpers';

type Analytics = {
  initiation: number;
  planning: number;
  inProgress: number;
  closing: number;
  total: number;
  totalActivities: number;
  doneActivities: number;
  byHealthScore: (ProjectRow & { hScore: number })[];
};

type Props = {
  analytics: Analytics;
  filteredPhaseDist: { phase: string; count: number }[];
  filteredProjectsLength: number;
};

export function AnalyticsMiddleRow({ analytics, filteredPhaseDist, filteredProjectsLength }: Props) {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
      <div className="xl:col-span-2 bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Activity Flow</h3>
            <p className="text-[11px] text-slate-400">Projects by phase</p>
          </div>
          <Activity className="h-4 w-4 text-slate-300" />
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          {[
            { label: 'Initiation', value: analytics.initiation, color: 'bg-purple-50 border-purple-200', text: 'text-purple-700', bar: 'bg-purple-500' },
            { label: 'Planning',   value: analytics.planning,   color: 'bg-blue-50 border-blue-200',     text: 'text-blue-700',   bar: 'bg-blue-500' },
            { label: 'Execution',  value: analytics.inProgress, color: 'bg-amber-50 border-amber-200',   text: 'text-amber-700',  bar: 'bg-amber-500' },
            { label: 'Closing',    value: analytics.closing,    color: 'bg-green-50 border-green-200',   text: 'text-green-700',  bar: 'bg-green-500' },
          ].map(({ label, value, color, text, bar }) => (
            <div key={label} className={`rounded-xl border p-3 ${color}`}>
              <p className={`text-2xl font-bold ${text}`}>{value}</p>
              <p className={`text-[11px] font-medium mt-0.5 ${text} opacity-80`}>{label}</p>
              <div className="mt-2 h-1 bg-white/60 rounded-full overflow-hidden">
                <div className={`h-full ${bar} rounded-full`} style={{ width: analytics.total ? `${(value / analytics.total) * 100}%` : '0%' }} />
              </div>
            </div>
          ))}
        </div>
        <ResponsiveContainer width="100%" height={80}>
          <BarChart data={filteredPhaseDist} barGap={4}>
            <XAxis dataKey="phase" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
            <YAxis hide allowDecimals={false} />
            <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
            <Bar dataKey="count" radius={[4,4,0,0]}>
              {filteredPhaseDist.map(d => (
                <Cell key={d.phase} fill={
                  d.phase === 'Initiation' ? '#a855f7' :
                  d.phase === 'Planning'   ? '#3b82f6' :
                  d.phase === 'Execution'  ? '#f59e0b' : '#22c55e'
                } />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {analytics.totalActivities > 0 && (
          <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-lg">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
            {Math.round((analytics.doneActivities / analytics.totalActivities) * 100)}% of all activities completed across portfolio
          </div>
        )}
      </div>

      <div className="xl:col-span-3 bg-white rounded-2xl border p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-700">Health by Project</h3>
            <p className="text-[11px] text-slate-400">Sorted by health score</p>
          </div>
          <Link href={filteredProjectsLength > 0 ? '#projects' : '/projects/new'} className="text-[11px] text-blue-600 hover:underline flex items-center gap-0.5">
            View all <ChevronRight className="h-3 w-3" />
          </Link>
        </div>
        {analytics.byHealthScore.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-slate-300 text-sm">No projects yet</div>
        ) : (
          <div className="space-y-3">
            {analytics.byHealthScore.map(p => {
              const hs = p.hScore;
              const { label, color } = healthLabel(hs);
              return (
                <Link key={p.id} href={`/projects/${p.id}`}>
                  <div className="flex items-center gap-3 group hover:bg-slate-50 px-2 py-1.5 rounded-lg transition-colors cursor-pointer">
                    <div className={`w-7 h-7 rounded-lg ${avatarBg(p.name)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                      {initials(p.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-xs font-semibold text-slate-700 truncate group-hover:text-blue-700">{p.name}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[10px] font-bold ${color}`}>{label}</span>
                          <span className="text-xs font-bold text-slate-700 w-6 text-right">{hs}</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${healthBarColor(hs)}`} style={{ width: `${hs}%` }} />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
