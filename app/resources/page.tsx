'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, ExternalLink } from 'lucide-react';

type Member = {
  id: number;
  domain: string;
  role: string;
  name: string;
  capacity_json: string;
  notes: string;
  project_name: string;
  project_id: string;
  start_date: string;
  end_date: string;
  current_phase: string;
  client: string;
};

function getMonths(start: string, end: string): string[] {
  if (!start || !end) {
    const now = new Date();
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });
  }
  const months: string[] = [];
  let d = new Date(start.substring(0, 7) + '-01');
  const e = new Date(end.substring(0, 7) + '-01');
  while (d <= e) {
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    d.setMonth(d.getMonth() + 1);
  }
  return months;
}

function displayMonth(ym: string) {
  const [y, m] = ym.split('-');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m)-1]}'${y.slice(2)}`;
}

function getGlobalMonths(members: Member[]): string[] {
  const allMonths = new Set<string>();
  for (const m of members) {
    try {
      const cap = JSON.parse(m.capacity_json || '{}');
      Object.keys(cap).forEach(k => allMonths.add(k));
    } catch { /* skip */ }
    const projectMonths = getMonths(m.start_date, m.end_date);
    projectMonths.forEach(pm => allMonths.add(pm));
  }
  return [...allMonths].sort();
}

function capacityBar(total: number) {
  const pct = Math.min(total, 1) * 100;
  const over = total > 1;
  const color = over
    ? 'bg-red-500'
    : total >= 0.8
    ? 'bg-amber-400'
    : total >= 0.3
    ? 'bg-blue-500'
    : 'bg-slate-200';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className={`text-[10px] font-mono font-medium ${over ? 'text-red-600' : 'text-slate-500'}`}>
        {(total * 100).toFixed(0)}%
      </span>
    </div>
  );
}

const PHASE_COLOR: Record<string, string> = {
  Initiation: 'bg-purple-100 text-purple-700',
  Planning: 'bg-blue-100 text-blue-700',
  Execution: 'bg-amber-100 text-amber-700',
  Closing: 'bg-green-100 text-green-700',
};

export default function GlobalResourcesPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [filterDomain, setFilterDomain] = useState('All');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/resources')
      .then(r => r.json())
      .then(data => { setMembers(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  const domains = ['All', ...new Set(members.map(m => m.domain))].sort();

  const filtered = members.filter(m => {
    const matchDomain = filterDomain === 'All' || m.domain === filterDomain;
    const q = search.toLowerCase();
    const matchSearch = !q || m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q) || m.project_name.toLowerCase().includes(q);
    return matchDomain && matchSearch;
  });

  // Aggregate capacity per person (same name+role across all projects)
  // Show individual project rows instead — easier to understand overload
  const globalMonths = getGlobalMonths(filtered);
  // Show only the next 6 months from today by default if too many months
  const now = new Date();
  const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const displayMonths = globalMonths.filter(m => m >= nowYM).slice(0, 8);
  const shownMonths = displayMonths.length > 0 ? displayMonths : globalMonths.slice(0, 8);

  // Group by name for overload detection
  const nameCapMap: Record<string, Record<string, number>> = {};
  for (const m of filtered) {
    const key = m.name.trim().toLowerCase();
    if (!nameCapMap[key]) nameCapMap[key] = {};
    try {
      const cap = JSON.parse(m.capacity_json || '{}');
      for (const [mo, val] of Object.entries(cap)) {
        nameCapMap[key][mo] = (nameCapMap[key][mo] || 0) + Number(val);
      }
    } catch { /* skip */ }
  }

  // Group display by domain
  const domains2 = [...new Set(filtered.map(m => m.domain))].sort();

  // Summary stats
  const totalMembers = new Set(members.map(m => m.name.trim().toLowerCase())).size;
  const overloaded = Object.entries(nameCapMap).filter(([, cap]) =>
    Object.values(cap).some(v => v > 1)
  ).length;
  const underutilized = Object.entries(nameCapMap).filter(([, cap]) => {
    const vals = Object.values(cap).filter(v => v > 0);
    return vals.length > 0 && vals.every(v => v < 0.3);
  }).length;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6 overflow-x-auto">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Global Resource View</h1>
            <p className="text-xs text-slate-400 mt-0.5">Tổng hợp capacity tất cả members across all projects</p>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500 mb-1">Total Members</p>
            <p className="text-2xl font-bold text-slate-800">{totalMembers}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500 mb-1">Total Allocations</p>
            <p className="text-2xl font-bold text-slate-800">{members.length}</p>
          </div>
          <div className={`rounded-xl border p-4 ${overloaded > 0 ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
            <p className="text-xs text-slate-500 mb-1">Overloaded (&gt;100%)</p>
            <p className={`text-2xl font-bold ${overloaded > 0 ? 'text-red-600' : 'text-slate-800'}`}>{overloaded}</p>
          </div>
          <div className={`rounded-xl border p-4 ${underutilized > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white'}`}>
            <p className="text-xs text-slate-500 mb-1">Under-utilized (&lt;30%)</p>
            <p className={`text-2xl font-bold ${underutilized > 0 ? 'text-amber-600' : 'text-slate-800'}`}>{underutilized}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search by name, role, project..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select value={filterDomain} onValueChange={v => setFilterDomain(v ?? 'All')}>
            <SelectTrigger className="w-40 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {domains.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm py-10">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-slate-400 text-sm py-10">No members found. Add members in individual project Resource Plans.</p>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ minWidth: '900px' }}>
                <thead>
                  <tr className="bg-[#1e293b] text-white">
                    <th className="px-3 py-3 text-left w-28">Domain</th>
                    <th className="px-3 py-3 text-left w-36">Name</th>
                    <th className="px-3 py-3 text-left w-32">Role</th>
                    <th className="px-3 py-3 text-left w-44">Project</th>
                    <th className="px-3 py-3 text-left w-24">Phase</th>
                    {shownMonths.map(mo => (
                      <th key={mo} className="px-2 py-3 text-center w-20">{displayMonth(mo)}</th>
                    ))}
                    <th className="px-3 py-3 text-left">Total Load</th>
                  </tr>
                </thead>
                <tbody>
                  {domains2.map(domain => {
                    const domainMembers = filtered.filter(m => m.domain === domain);
                    return (
                      <>
                        <tr key={`domain-${domain}`}>
                          <td colSpan={6 + shownMonths.length} className="px-4 py-2 bg-slate-100 font-semibold text-slate-600 text-xs uppercase tracking-wide border-t-2 border-slate-200">
                            {domain}
                          </td>
                        </tr>
                        {domainMembers.map(m => {
                          const cap = (() => { try { return JSON.parse(m.capacity_json || '{}'); } catch { return {}; } })();
                          const nameKey = m.name.trim().toLowerCase();
                          const totalThisPerson = nameCapMap[nameKey] ?? {};
                          const isOverloaded = Object.values(totalThisPerson).some(v => Number(v) > 1.05);

                          return (
                            <tr key={`${m.id}-${m.project_id}`} className={`border-t hover:bg-slate-50 ${isOverloaded ? 'bg-red-50/30' : ''}`}>
                              <td className="px-3 py-2 text-slate-500">{m.domain}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">
                                {isOverloaded && <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1.5 mb-0.5" />}
                                {m.name}
                              </td>
                              <td className="px-3 py-2 text-slate-500">{m.role}</td>
                              <td className="px-3 py-2">
                                <Link href={`/projects/${m.project_id}/resources`} className="flex items-center gap-1 text-blue-600 hover:underline">
                                  {m.project_name}
                                  <ExternalLink className="h-2.5 w-2.5" />
                                </Link>
                                {m.client && <span className="text-slate-400 text-[10px]">{m.client}</span>}
                              </td>
                              <td className="px-3 py-2">
                                <Badge className={`text-[10px] ${PHASE_COLOR[m.current_phase] ?? 'bg-slate-100 text-slate-600'}`}>
                                  {m.current_phase}
                                </Badge>
                              </td>
                              {shownMonths.map(mo => {
                                const val = cap[mo];
                                const totalForMonth = totalThisPerson[mo] || 0;
                                const overMonth = totalForMonth > 1.05;
                                return (
                                  <td key={mo} className={`px-2 py-2 text-center ${overMonth ? 'bg-red-50' : ''}`}>
                                    {val != null && val !== 0 ? (
                                      <span className={`font-medium ${overMonth ? 'text-red-600' : 'text-slate-700'}`}>
                                        {Number(val).toFixed(1)}
                                      </span>
                                    ) : (
                                      <span className="text-slate-200">—</span>
                                    )}
                                  </td>
                                );
                              })}
                              <td className="px-3 py-2">
                                {capacityBar(Math.max(...shownMonths.map(mo => totalThisPerson[mo] || 0), 0))}
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400 mt-3">
          Values show per-project allocation (0–1 = 0–100%). Red = overloaded across projects. Click project name to edit.
        </p>
      </main>
    </div>
  );
}
