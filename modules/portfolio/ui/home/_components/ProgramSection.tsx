'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  Plus, FolderOpen, ShieldAlert, Bug, Activity, ChevronDown, ChevronUp,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { ProgramGroup } from '../types';
import { avatarBg, initials, PHASE_COLOR, INDUSTRY_COLOR } from './helpers';
import { ProjectCard } from './ProjectCard';

export function ProgramSection({ program, defaultOpen }: { program: ProgramGroup; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const phases = ['Initiation','Planning','Execution','Closing'];
  const phaseCounts = Object.fromEntries(phases.map(ph => [ph, program.projects.filter(p => p.current_phase === ph).length]));
  const openRisks  = program.projects.reduce((s, p) => s + p.open_risks, 0);
  const openIssues = program.projects.reduce((s, p) => s + p.open_issues, 0);
  const avgPct = program.projects.length ? Math.round(program.projects.reduce((s, p) => s + p.completion_pct, 0) / program.projects.length) : 0;
  return (
    <div className="rounded-2xl border bg-white overflow-hidden">
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center gap-4 px-6 py-4 hover:bg-slate-50/80 transition-colors text-left">
        <div className={`w-10 h-10 rounded-xl ${avatarBg(program.name)} flex items-center justify-center text-white font-bold shrink-0`}>{initials(program.name)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-800">{program.name}</span>
            {program.industry && <Badge className={`text-[10px] ${INDUSTRY_COLOR[program.industry] ?? 'bg-slate-100 text-slate-600'}`}>{program.industry}</Badge>}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 flex-wrap">
            <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{program.projects.length} projects</span>
            {phases.map(ph => phaseCounts[ph] > 0 && <span key={ph} className={`px-1.5 py-px rounded text-[10px] font-semibold ${PHASE_COLOR[ph]}`}>{phaseCounts[ph]} {ph}</span>)}
            {openRisks > 0 && <span className="flex items-center gap-1 text-red-400"><ShieldAlert className="h-3 w-3" />{openRisks}</span>}
            {openIssues > 0 && <span className="flex items-center gap-1 text-violet-400"><Bug className="h-3 w-3" />{openIssues}</span>}
            <span className="flex items-center gap-1 ml-1"><Activity className="h-3 w-3 text-blue-400" />{avgPct}% avg</span>
          </div>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400 shrink-0" /> : <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />}
      </button>
      {open && (
        <div className="px-6 pb-5 border-t bg-slate-50/40">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-4">
            {program.projects.map(p => <ProjectCard key={p.id} p={p} />)}
            <Link href="/projects/new">
              <div className="rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 transition-colors p-4 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-blue-500 cursor-pointer h-full min-h-[120px]">
                <Plus className="h-4 w-4" /> New Project
              </div>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
