'use client';
import { cn } from '@/lib/utils';
import { CheckCircle2, Circle, Clock } from 'lucide-react';

const PHASES = ['Initiation', 'Planning', 'Execution', 'Closing'];

const PHASE_DOCS: Record<string, string[]> = {
  Initiation: ['Project Charter', 'Core Team List', 'Official Project Request'],
  Planning: ['Statement of Work (SoW)', 'Project Management Plan (PMP)', 'Stakeholder Register', 'RACI Matrix'],
  Execution: ['Kick-off Presentation', 'Weekly Status Reports', 'Change Request Forms'],
  Closing: ['Project Closure Report'],
};

export default function PhaseTracker({ currentPhase }: { currentPhase: string }) {
  const currentIdx = PHASES.indexOf(currentPhase);

  return (
    <div className="bg-white rounded-xl border p-6">
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-5">Process Phases</h2>
      <div className="flex items-start gap-0">
        {PHASES.map((phase, idx) => {
          const done = idx < currentIdx;
          const active = idx === currentIdx;
          const upcoming = idx > currentIdx;
          return (
            <div key={phase} className="flex-1 flex flex-col items-center relative">
              {/* connector line */}
              {idx < PHASES.length - 1 && (
                <div className={cn(
                  'absolute top-4 left-1/2 w-full h-0.5 z-0',
                  done ? 'bg-blue-500' : 'bg-slate-200'
                )} />
              )}
              {/* icon */}
              <div className={cn(
                'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2 mb-3',
                done ? 'bg-blue-500 border-blue-500 text-white' :
                active ? 'bg-white border-blue-500 text-blue-500' :
                'bg-white border-slate-200 text-slate-300'
              )}>
                {done ? <CheckCircle2 className="h-4 w-4" /> :
                 active ? <Clock className="h-4 w-4" /> :
                 <Circle className="h-4 w-4" />}
              </div>
              {/* label */}
              <p className={cn(
                'text-xs font-semibold text-center mb-2',
                active ? 'text-blue-600' : done ? 'text-slate-600' : 'text-slate-400'
              )}>{phase}</p>
              {/* doc list */}
              <ul className="text-xs text-slate-400 space-y-1 text-center px-1">
                {PHASE_DOCS[phase].map(d => (
                  <li key={d} className={cn(
                    'flex items-center gap-1 justify-center',
                    done ? 'text-slate-500 line-through' : active ? 'text-slate-600' : 'text-slate-300'
                  )}>
                    {d}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
