import { LayoutGrid } from 'lucide-react';
import type { PortfolioData } from '../types';
import { avatarBg, initials } from './helpers';

type Props = {
  data: PortfolioData;
  selectedProgramId: number | null;
  onSelectProgram: (id: number | null) => void;
};

export function ProgramTabs({ data, selectedProgramId, onSelectProgram }: Props) {
  return (
    <div className="bg-white rounded-2xl border p-2">
      <div className="flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => onSelectProgram(null)}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${selectedProgramId === null ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}
        >
          <LayoutGrid className="h-4 w-4" /> All
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedProgramId === null ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{data.projects.length}</span>
        </button>
        {data.programs.length > 0 && <div className="w-px h-5 bg-slate-200 shrink-0 mx-1" />}
        {data.programs.map(c => {
          const isActive = selectedProgramId === c.id;
          return (
            <button key={c.id} onClick={() => onSelectProgram(isActive ? null : c.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100'}`}>
              <div className={`w-5 h-5 rounded-md ${avatarBg(c.name)} flex items-center justify-center text-white text-[9px] font-bold shrink-0`}>{initials(c.name)}</div>
              <span className="max-w-[120px] truncate">{c.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold shrink-0 ${isActive ? 'bg-blue-500 text-white' : 'bg-slate-100 text-slate-500'}`}>{c.projects.length}</span>
            </button>
          );
        })}
        {data.noProgramProjects.length > 0 && (
          <button onClick={() => onSelectProgram(selectedProgramId === 0 ? null : 0)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors shrink-0 ${selectedProgramId === 0 ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-100'}`}>
            Unassigned
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${selectedProgramId === 0 ? 'bg-slate-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{data.noProgramProjects.length}</span>
          </button>
        )}
      </div>
    </div>
  );
}
