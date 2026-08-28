import { Building2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PortfolioData } from '../types';
import { avatarBg, initials, INDUSTRY_COLOR } from './helpers';
import { RagBadge } from './RagBadge';

type Props = { data: PortfolioData };

export function ProgramScorecard({ data }: Props) {
  const programsWithProjects = data.programs.filter(c => c.projects.length > 0);
  if (programsWithProjects.length === 0) return null;

  return (
    <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800">
        <h2 className="text-sm font-bold text-white flex items-center gap-2">
          <Building2 className="h-4 w-4 text-slate-300" />
          Program Portfolio Scorecard
        </h2>
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-600 text-slate-200 font-medium">
          {data.programs.length} programs
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-100">
              <th className="px-4 py-2.5 text-left">Program</th>
              <th className="px-4 py-2.5 text-left">Industry</th>
              <th className="px-4 py-2.5 text-center">Projects</th>
              <th className="px-4 py-2.5 text-center">Active</th>
              <th className="px-4 py-2.5 text-left w-36">Avg Progress</th>
              <th className="px-4 py-2.5 text-left">Health</th>
              <th className="px-4 py-2.5 text-center">Risks</th>
              <th className="px-4 py-2.5 text-center">Issues</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {programsWithProjects.map(c => {
              const avgPct = Math.round(c.projects.reduce((s, p) => s + Number(p.completion_pct), 0) / c.projects.length);
              const activeCount = c.projects.filter(p => p.current_phase !== 'Closing').length;
              const worstRag: 'red' | 'amber' | 'green' = c.projects.some(p => p.rag === 'red') ? 'red' : c.projects.some(p => p.rag === 'amber') ? 'amber' : 'green';
              const risks = c.projects.reduce((s, p) => s + Number(p.open_risks), 0);
              const issues = c.projects.reduce((s, p) => s + Number(p.open_issues), 0);
              return (
                <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg ${avatarBg(c.name)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>
                        {initials(c.name)}
                      </div>
                      {c.name}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {c.industry ? (
                      <Badge className={`text-[10px] ${INDUSTRY_COLOR[c.industry] ?? 'bg-slate-100 text-slate-600'}`}>{c.industry}</Badge>
                    ) : <span className="text-slate-400 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center text-slate-600">{c.projects.length}</td>
                  <td className="px-4 py-3 text-center text-slate-600">{activeCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${avgPct >= 70 ? 'bg-green-500' : avgPct >= 40 ? 'bg-blue-500' : 'bg-amber-400'}`} style={{ width: `${avgPct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-slate-600 w-8 text-right">{avgPct}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3"><RagBadge rag={worstRag} /></td>
                  <td className={`px-4 py-3 text-center text-xs font-semibold ${risks > 0 ? 'text-red-500' : 'text-slate-400'}`}>{risks}</td>
                  <td className={`px-4 py-3 text-center text-xs font-semibold ${issues > 0 ? 'text-amber-500' : 'text-slate-400'}`}>{issues}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {data.noProgramProjects.length > 0 && (
          <div className="px-5 py-2.5 border-t text-xs text-slate-400 italic">
            {data.noProgramProjects.length} project(s) not assigned to any program
          </div>
        )}
      </div>
    </div>
  );
}
