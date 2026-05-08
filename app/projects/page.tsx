'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Calendar, User, Building2, ArrowRight } from 'lucide-react';

type Project = {
  id: number; name: string; client: string; pm_name: string;
  start_date: string; end_date: string; current_phase: string;
  description: string; created_at: string;
};

const PHASE_COLOR: Record<string, string> = {
  Initiation: 'bg-purple-100 text-purple-700',
  Planning:   'bg-blue-100 text-blue-700',
  Execution:  'bg-amber-100 text-amber-700',
  Closing:    'bg-green-100 text-green-700',
};

const PHASE_BAR: Record<string, string> = {
  Initiation: 'bg-purple-400',
  Planning:   'bg-blue-400',
  Execution:  'bg-amber-400',
  Closing:    'bg-green-400',
};

const PHASE_ORDER = ['Initiation', 'Planning', 'Execution', 'Closing'];

function PhaseProgress({ phase }: { phase: string }) {
  const idx = PHASE_ORDER.indexOf(phase);
  return (
    <div className="flex gap-1">
      {PHASE_ORDER.map((p, i) => (
        <div
          key={p}
          className={`h-1.5 flex-1 rounded-full ${i <= idx ? (PHASE_BAR[phase] ?? 'bg-slate-300') : 'bg-slate-100'}`}
        />
      ))}
    </div>
  );
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPhase, setFilterPhase] = useState('All');

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then(data => {
      setProjects(Array.isArray(data) ? data : []);
      setLoading(false);
    });
  }, []);

  const filtered = projects.filter(p => {
    const matchPhase = filterPhase === 'All' || p.current_phase === filterPhase;
    const q = search.toLowerCase();
    const matchSearch = !q || p.name.toLowerCase().includes(q) || p.client?.toLowerCase().includes(q) || p.pm_name?.toLowerCase().includes(q);
    return matchPhase && matchSearch;
  });

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Projects</h1>
            <p className="text-slate-400 text-sm mt-0.5">{projects.length} project{projects.length !== 1 ? 's' : ''} total</p>
          </div>
          <Link href="/projects/new">
            <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              className="pl-8 h-9 text-sm"
              placeholder="Search by name, client, PM..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1">
            {['All', ...PHASE_ORDER].map(p => (
              <button
                key={p}
                onClick={() => setFilterPhase(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  filterPhase === p
                    ? 'bg-slate-800 text-white'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loading ? (
          <p className="text-slate-400 text-sm py-10">Loading...</p>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-slate-400 mb-4">
              {search || filterPhase !== 'All' ? 'No projects match your filter.' : 'No projects yet.'}
            </p>
            {!search && filterPhase === 'All' && (
              <Link href="/projects/new">
                <Button className="bg-blue-600 hover:bg-blue-700 gap-2">
                  <Plus className="h-4 w-4" /> Create First Project
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden shadow-sm divide-y">
            {filtered.map(p => (
              <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-5 px-5 py-4 hover:bg-slate-50 transition-colors group">
                {/* Phase indicator bar */}
                <div className={`w-1 self-stretch rounded-full shrink-0 ${PHASE_BAR[p.current_phase] ?? 'bg-slate-200'}`} />

                {/* Main info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-slate-800 text-sm truncate">{p.name}</h3>
                    <Badge className={`text-[10px] shrink-0 ${PHASE_COLOR[p.current_phase] ?? 'bg-slate-100 text-slate-600'}`}>
                      {p.current_phase}
                    </Badge>
                  </div>
                  {p.description && (
                    <p className="text-xs text-slate-400 truncate mb-1.5">{p.description}</p>
                  )}
                  <PhaseProgress phase={p.current_phase} />
                </div>

                {/* Meta */}
                <div className="flex gap-5 shrink-0 text-xs text-slate-400">
                  {p.client && (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3" /> {p.client}
                    </span>
                  )}
                  {p.pm_name && (
                    <span className="flex items-center gap-1.5">
                      <User className="h-3 w-3" /> {p.pm_name}
                    </span>
                  )}
                  {(p.start_date || p.end_date) && (
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {p.start_date || '?'} → {p.end_date || '?'}
                    </span>
                  )}
                </div>

                <ArrowRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
