import Link from 'next/link';
import { Plus, Building2, FileBarChart2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { ProgramGroup } from '../types';

type Props = {
  dateStr: string;
  companyName: string;
  activeProgram: ProgramGroup | null;
};

export function PortfolioHeader({ dateStr, companyName, activeProgram }: Props) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap">
      <div>
        <p className="text-xs text-slate-400 mb-0.5">{dateStr}</p>
        <h1 className="text-2xl font-bold text-slate-900">Portfolio Health Check</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          AI-powered workspace analysis · {companyName || 'All Projects'}
          {activeProgram && <> · <span className="text-blue-600 font-semibold">{activeProgram.name}</span></>}
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <Link href="/portfolio/report">
          <Button variant="outline" className="h-9 text-sm gap-2">
            <FileBarChart2 className="h-4 w-4 text-blue-500" /> Portfolio Report
          </Button>
        </Link>
        <Link href="/programs">
          <Button variant="outline" className="h-9 text-sm gap-2">
            <Building2 className="h-4 w-4" /> Programs
          </Button>
        </Link>
        <Link href="/projects/new">
          <Button className="bg-blue-600 hover:bg-blue-700 gap-2 h-9">
            <Plus className="h-4 w-4" /> New Project
          </Button>
        </Link>
      </div>
    </div>
  );
}
