'use client';
import { FileText, AlertCircle } from 'lucide-react';
import type { PortfolioReportData, ProjectRow } from '../types';
import { fmtDate } from './helpers';

export function ReportHeaderKpi({ data, companyName, red, amber, green }: {
  data: PortfolioReportData | null;
  companyName: string;
  red: ProjectRow[];
  amber: ProjectRow[];
  green: ProjectRow[];
}) {
  return (
<>
    {/* ── 1. Header ── */}
    <div className="flex items-start justify-between gap-4 flex-wrap">
    <div>
    <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
    <FileText className="h-5 w-5 text-blue-600" />
    Portfolio Status Report
    </h1>
    <p className="text-sm text-slate-500 mt-0.5">
    PMO-Grade Portfolio Report · {companyName}
    {data?.reportDate && (
    <span className="ml-2 text-slate-400">· {fmtDate(data.reportDate)}</span>
    )}
    </p>
    </div>
    </div>
    
    {/* ── 2. KPI Bar ── */}
    {data && (
    <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
    <div className="bg-white border rounded-xl px-4 py-3">
    <div className="text-2xl font-bold text-slate-800">{data.kpi.totalProjects}</div>
    <div className="text-[11px] text-slate-400 mt-0.5">Total Projects</div>
    </div>
    <div className="bg-white border rounded-xl px-4 py-3">
    <div className="text-2xl font-bold text-slate-800">{data.kpi.activeProjects}</div>
    <div className="text-[11px] text-slate-400 mt-0.5">Active</div>
    </div>
    <div className="bg-white border rounded-xl px-4 py-3">
    <div className="text-2xl font-bold text-slate-800">{data.kpi.totalPrograms}</div>
    <div className="text-[11px] text-slate-400 mt-0.5">Programs</div>
    </div>
    <div className="bg-white border rounded-xl px-4 py-3">
    <div className="text-2xl font-bold text-slate-800">{data.kpi.avgCompletion}%</div>
    <div className="text-[11px] text-slate-400 mt-0.5">Avg. Completion</div>
    </div>
    <div className={`rounded-xl px-4 py-3 border ${data.kpi.totalOpenRisks > 0 ? 'bg-red-50 border-red-100' : 'bg-white'}`}>
    <div className={`text-2xl font-bold ${data.kpi.totalOpenRisks > 0 ? 'text-red-600' : 'text-slate-800'}`}>{data.kpi.totalOpenRisks}</div>
    <div className="text-[11px] text-slate-400 mt-0.5">Open Risks</div>
    </div>
    <div className={`rounded-xl px-4 py-3 border ${data.kpi.totalOpenIssues > 0 ? 'bg-amber-50 border-amber-100' : 'bg-white'}`}>
    <div className={`text-2xl font-bold ${data.kpi.totalOpenIssues > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{data.kpi.totalOpenIssues}</div>
    <div className="text-[11px] text-slate-400 mt-0.5">Open Issues</div>
    </div>
    </div>
    )}
    
    {/* ── 3. RAG Health Bar ── */}
    {data && (
    <div className="bg-white border rounded-xl px-5 py-4">
    <div className="flex items-center gap-4 flex-wrap">
    <span className="text-sm font-semibold text-slate-600">Portfolio Health:</span>
    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-red-50 border border-red-200 text-red-700">
    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> {red.length} RED
    </span>
    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-50 border border-amber-200 text-amber-700">
    <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block" /> {amber.length} AMBER
    </span>
    <span className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-green-50 border border-green-200 text-green-700">
    <span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> {green.length} GREEN
    </span>
    </div>
    {red.length > 0 && (
    <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-sm text-red-700 font-medium">
    <AlertCircle className="h-4 w-4 shrink-0" />
    {red.length} project{red.length !== 1 ? 's' : ''} require{red.length === 1 ? 's' : ''} immediate attention
    </div>
    )}
    </div>
    )}
</>
  );
}
