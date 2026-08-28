import Link from 'next/link';
import { Plus, FolderOpen, LayoutGrid, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PortfolioData, ProgramGroup, ProjectRow } from '../types';
import { avatarBg, initials, INDUSTRY_COLOR } from './helpers';
import { ListRow } from './ListRow';
import { ProjectCard } from './ProjectCard';
import { ProgramSection } from './ProgramSection';

type Props = {
  data: PortfolioData;
  filteredProjects: ProjectRow[];
  selectedProgramId: number | null;
  activeProgram: ProgramGroup | null;
  viewMode: 'cards' | 'list';
  onViewModeChange: (mode: 'cards' | 'list') => void;
};

export function ProjectsSection({
  data, filteredProjects, selectedProgramId, activeProgram, viewMode, onViewModeChange,
}: Props) {
  const showAllPrograms   = selectedProgramId === null;
  const showSingleProgram = selectedProgramId !== null && selectedProgramId !== 0 && activeProgram;
  const showNoProgram     = selectedProgramId === 0;

  return (
    <div className="space-y-4" id="projects">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-widest">
          {selectedProgramId === null ? 'All Program Portfolios' : selectedProgramId === 0 ? 'Unassigned Projects' : `${activeProgram?.name ?? ''} — Projects`}
        </h2>
        <div className="flex items-center gap-2 ml-auto">
          {viewMode === 'list' && filteredProjects.length > 0 && (() => {
            const red   = filteredProjects.filter(p => p.rag === 'red').length;
            const amber = filteredProjects.filter(p => p.rag === 'amber').length;
            const green = filteredProjects.filter(p => p.rag === 'green').length;
            return (
              <div className="flex items-center gap-2 text-[11px] font-semibold">
                {red   > 0 && <span className="flex items-center gap-1 text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">🔴 {red}</span>}
                {amber > 0 && <span className="flex items-center gap-1 text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">🟡 {amber}</span>}
                {green > 0 && <span className="flex items-center gap-1 text-green-600 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">🟢 {green}</span>}
              </div>
            );
          })()}
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5">
            <button onClick={() => onViewModeChange('cards')} title="Cards view"
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'cards' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
              <LayoutGrid className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onViewModeChange('list')} title="List view"
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white shadow text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}>
              <List className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {filteredProjects.length === 0 && data.programs.length === 0 && (
        <div className="text-center py-20 rounded-2xl border bg-white">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 text-sm mb-4">No projects yet.</p>
          <Link href="/projects/new">
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2"><Plus className="h-4 w-4" /> Create First Project</Button>
          </Link>
        </div>
      )}

      {viewMode === 'list' && filteredProjects.length > 0 && (() => {
        const sorted = [...filteredProjects].sort((a, b) => {
          const order = { red: 0, amber: 1, green: 2 };
          if (order[a.rag] !== order[b.rag]) return order[a.rag] - order[b.rag];
          return (a.days_until_deadline ?? 9999) - (b.days_until_deadline ?? 9999);
        });
        return (
          <div className="bg-white rounded-2xl border overflow-hidden shadow-sm">
            <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 border-b text-[10px] font-bold text-slate-400 uppercase tracking-wide">
              <div className="w-16 shrink-0">Status</div>
              <div className="flex-1">Project</div>
              <div className="w-24 shrink-0 hidden md:block">Phase</div>
              <div className="w-28 shrink-0 hidden lg:block">Progress</div>
              <div className="w-28 shrink-0 hidden xl:block">Deadline</div>
              <div className="w-16 shrink-0">Alerts</div>
              <div className="w-24 shrink-0 hidden xl:block">PM</div>
            </div>
            {sorted.map(p => <ListRow key={p.id} p={p} />)}
          </div>
        );
      })()}

      {viewMode === 'cards' && showAllPrograms && data.programs.map((c, i) => (
        <ProgramSection key={c.id} program={c} defaultOpen={i === 0} />
      ))}
      {viewMode === 'cards' && showSingleProgram && activeProgram && (
        <div className="bg-white rounded-2xl border p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className={`w-12 h-12 rounded-xl ${avatarBg(activeProgram.name)} flex items-center justify-center text-white font-bold text-lg shrink-0`}>{initials(activeProgram.name)}</div>
            <div>
              <h3 className="font-bold text-slate-800 text-lg">{activeProgram.name}</h3>
              {activeProgram.industry && <Badge className={`text-[10px] mt-0.5 ${INDUSTRY_COLOR[activeProgram.industry] ?? 'bg-slate-100 text-slate-600'}`}>{activeProgram.industry}</Badge>}
            </div>
            <Link href="/programs" className="ml-auto text-xs text-blue-600 hover:underline">Edit program →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {activeProgram.projects.map(p => <ProjectCard key={p.id} p={p} />)}
            <Link href="/projects/new">
              <div className="rounded-xl border-2 border-dashed border-slate-200 hover:border-blue-300 transition-colors p-4 flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-blue-500 cursor-pointer h-full min-h-[120px]">
                <Plus className="h-4 w-4" /> New Project
              </div>
            </Link>
          </div>
        </div>
      )}
      {viewMode === 'cards' && showNoProgram && (
        <div className="bg-white rounded-2xl border p-6">
          <h3 className="font-bold text-slate-700 mb-4">Unassigned Projects</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {data.noProgramProjects.map(p => <ProjectCard key={p.id} p={p} />)}
          </div>
        </div>
      )}
      {viewMode === 'cards' && showAllPrograms && data.noProgramProjects.length > 0 && (
        <ProgramSection program={{ id: 0, name: 'Unassigned Projects', industry: '', projects: data.noProgramProjects }} defaultOpen={false} />
      )}
    </div>
  );
}
