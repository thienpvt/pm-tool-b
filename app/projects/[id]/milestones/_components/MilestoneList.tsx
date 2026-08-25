'use client';
import { ChevronRight, Flag, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Milestone, Project } from '../types';
import { fmt } from './helpers';

type Props = {
  project: Project | null;
  milestones: Milestone[];
  selected: Milestone | null;
  onSelect: (m: Milestone) => void;
  onCreate: () => void;
  onEdit: (m: Milestone) => void;
  onDelete: (m: Milestone) => void;
};

export function MilestonePageHeader({ project, onCreate }: Pick<Props, 'project' | 'onCreate'>) {
  return (
    <div className="border-b border-slate-200 bg-white px-8 py-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 mb-0.5">{project?.name}</p>
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Flag className="h-5 w-5 text-orange-500" />
            Milestones
          </h1>
        </div>
        <Button onClick={onCreate} className="gap-1.5 bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-4 w-4" />
          Tạo Milestone
        </Button>
      </div>
    </div>
  );
}

export function MilestoneList({ milestones, selected, onSelect, onEdit, onDelete }: Omit<Props, 'project' | 'onCreate'>) {
  if (milestones.length === 0) {
    return (
      <div className="p-8 text-center text-slate-400">
        <Flag className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm">Chưa có milestone nào.</p>
        <p className="text-xs mt-1">Nhấn &quot;+ Tạo Milestone&quot; để bắt đầu.</p>
      </div>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {milestones.map(m => (
        <li
          key={m.id}
          onClick={() => onSelect(m)}
          className={`px-4 py-3 cursor-pointer hover:bg-orange-50 transition-colors ${selected?.id === m.id ? 'bg-orange-50 border-l-2 border-orange-500' : 'border-l-2 border-transparent'}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-800 text-sm truncate">{m.name}</p>
              <p className="text-xs text-slate-400 mt-0.5">
                {fmt(m.start_date)} → {fmt(m.end_date)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={e => { e.stopPropagation(); onEdit(m); }} className="p-1 rounded hover:bg-slate-200 text-slate-500">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={e => { e.stopPropagation(); onDelete(m); }} className="p-1 rounded hover:bg-red-100 text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
