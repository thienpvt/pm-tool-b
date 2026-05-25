'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Search, ExternalLink, Users, ChevronRight } from 'lucide-react';

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

type PersonSummary = {
  name: string;
  role: string;
  domain: string;
  projectCount: number;
  capByMonth: Record<string, number>;
  capToDate: number;
  maxLoad: number;
  rows: Member[];
};

function displayMonth(ym: string) {
  const [y, m] = ym.split('-');
  return `${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][Number(m)-1]}'${y.slice(2)}`;
}

const PHASE_COLOR: Record<string, string> = {
  Initiation: 'bg-purple-100 text-purple-700',
  Planning:   'bg-blue-100 text-blue-700',
  Execution:  'bg-amber-100 text-amber-700',
  Closing:    'bg-green-100 text-green-700',
};

function LoadBar({ value, max = 1 }: { value: number; max?: number }) {
  const pct = Math.min(value / Math.max(max, 1), 1) * 100;
  const over = value > 1;
  const color = over ? 'bg-red-500' : value >= 0.8 ? 'bg-amber-400' : value >= 0.3 ? 'bg-blue-500' : 'bg-slate-300';
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value * 100, 100)}%` }} />
      </div>
      <span className={`text-[11px] font-mono font-semibold tabular-nums ${over ? 'text-red-600' : 'text-slate-500'}`}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

// ── Detail dialog ─────────────────────────────────────────────────────────────
function PersonDetailDialog({
  person,
  onClose,
}: {
  person: PersonSummary | null;
  onClose: () => void;
}) {
  if (!person) return null;

  const now = new Date();
  const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const projects = person.rows.map(m => {
    const cap = (() => { try { return JSON.parse(m.capacity_json || '{}') as Record<string, number>; } catch { return {} as Record<string, number>; } })();
    let toDate = 0, future = 0;
    for (const [mo, val] of Object.entries(cap)) {
      if (mo <= nowYM) toDate += Number(val);
      else future += Number(val);
    }
    return { ...m, cap, toDate, future };
  });

  const grandToDate = projects.reduce((s, p) => s + p.toDate, 0);
  const grandFuture = projects.reduce((s, p) => s + p.future, 0);

  // All months across all projects, sorted
  const allMonthsSet = new Set<string>();
  for (const p of projects) Object.keys(p.cap).forEach(k => allMonthsSet.add(k));
  const allMonths = [...allMonthsSet].sort();
  const pastMonths = allMonths.filter(m => m <= nowYM);
  const futureMonths = allMonths.filter(m => m > nowYM);

  return (
    <Dialog open={!!person} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 py-5 border-b bg-gradient-to-r from-slate-800 to-slate-700 rounded-t-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold text-white">{person.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                {person.role && <span className="text-xs text-slate-300">{person.role}</span>}
                {person.role && person.domain && <span className="text-slate-500">·</span>}
                {person.domain && <span className="text-xs text-slate-400">{person.domain}</span>}
              </div>
            </div>
            <div className="flex gap-3">
              <div className="text-center bg-white/10 rounded-lg px-4 py-2">
                <p className="text-xs text-slate-300 mb-0.5">Tổng đến nay</p>
                <p className="text-xl font-bold text-white">{grandToDate.toFixed(1)}</p>
                <p className="text-[10px] text-slate-400">person-months</p>
              </div>
              <div className="text-center bg-white/10 rounded-lg px-4 py-2">
                <p className="text-xs text-slate-300 mb-0.5">Tương lai</p>
                <p className="text-xl font-bold text-white">{grandFuture.toFixed(1)}</p>
                <p className="text-[10px] text-slate-400">person-months</p>
              </div>
              <div className="text-center bg-white/10 rounded-lg px-4 py-2">
                <p className="text-xs text-slate-300 mb-0.5">Dự án</p>
                <p className="text-xl font-bold text-white">{projects.length}</p>
                <p className="text-[10px] text-slate-400">project{projects.length !== 1 ? 's' : ''}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Project breakdown */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Phân bổ theo dự án</p>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-2.5 text-left text-slate-500 font-medium">Dự án</th>
                    <th className="px-4 py-2.5 text-left text-slate-500 font-medium">Client</th>
                    <th className="px-4 py-2.5 text-left text-slate-500 font-medium">Phase</th>
                    <th className="px-4 py-2.5 text-right text-slate-500 font-medium">Đến nay</th>
                    <th className="px-4 py-2.5 text-right text-slate-500 font-medium">Tương lai</th>
                    <th className="px-4 py-2.5 text-right text-slate-500 font-medium">Tổng</th>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((p, i) => (
                    <tr key={i} className={`border-t ${i % 2 === 1 ? 'bg-slate-50/50' : ''} hover:bg-blue-50/30 transition-colors`}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/projects/${p.project_id}/resources`}
                          className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium group"
                        >
                          {p.project_name}
                          <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{p.client || '—'}</td>
                      <td className="px-4 py-3">
                        <Badge className={`text-[10px] ${PHASE_COLOR[p.current_phase] ?? 'bg-slate-100 text-slate-600'}`}>
                          {p.current_phase}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.toDate > 0
                          ? <span className="font-semibold text-blue-700">{p.toDate.toFixed(2)} PM</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.future > 0
                          ? <span className="text-slate-600">{p.future.toFixed(2)} PM</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-slate-700">
                        {(p.toDate + p.future).toFixed(2)} PM
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-100 font-semibold">
                    <td className="px-4 py-2.5 text-slate-700" colSpan={3}>Total</td>
                    <td className="px-4 py-2.5 text-right text-blue-700">{grandToDate.toFixed(2)} PM</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{grandFuture.toFixed(2)} PM</td>
                    <td className="px-4 py-2.5 text-right text-slate-700">{(grandToDate + grandFuture).toFixed(2)} PM</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Monthly breakdown */}
          {allMonths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Phân bổ theo tháng</p>
              <div className="rounded-xl border overflow-x-auto">
                <table className="text-xs" style={{ minWidth: `${180 + allMonths.length * 60}px` }}>
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2.5 text-left text-slate-500 font-medium bg-slate-50 sticky left-0 z-10 w-44">Dự án</th>
                      {pastMonths.map(mo => (
                        <th key={mo} className="px-2 py-2.5 text-center font-medium text-blue-500 bg-blue-50/40 w-14 border-l border-blue-100">
                          {displayMonth(mo)}
                        </th>
                      ))}
                      {futureMonths.map(mo => (
                        <th key={mo} className="px-2 py-2.5 text-center font-medium text-slate-400 bg-slate-50 w-14 border-l border-slate-100">
                          {displayMonth(mo)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {projects.map((p, i) => (
                      <tr key={i} className={`border-t ${i % 2 === 1 ? 'bg-slate-50/30' : ''}`}>
                        <td className="px-4 py-2.5 font-medium text-slate-700 truncate max-w-[176px] bg-white sticky left-0 border-r border-slate-100">
                          {p.project_name}
                        </td>
                        {pastMonths.map(mo => {
                          const val = p.cap[mo];
                          return (
                            <td key={mo} className="px-2 py-2.5 text-center bg-blue-50/20 border-l border-blue-50">
                              {val != null && Number(val) !== 0
                                ? <span className="font-semibold text-blue-700">{Number(val).toFixed(1)}</span>
                                : <span className="text-slate-200">—</span>}
                            </td>
                          );
                        })}
                        {futureMonths.map(mo => {
                          const val = p.cap[mo];
                          return (
                            <td key={mo} className="px-2 py-2.5 text-center border-l border-slate-100">
                              {val != null && Number(val) !== 0
                                ? <span className="text-slate-600">{Number(val).toFixed(1)}</span>
                                : <span className="text-slate-200">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-200 font-semibold bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-600 sticky left-0 bg-slate-100 border-r border-slate-200">Tổng / tháng</td>
                      {pastMonths.map(mo => {
                        const total = projects.reduce((s, p) => s + (Number(p.cap[mo]) || 0), 0);
                        return (
                          <td key={mo} className="px-2 py-2.5 text-center bg-blue-50/40 border-l border-blue-100">
                            {total > 0
                              ? <span className={total > 1 ? 'text-red-600 font-bold' : 'text-blue-700'}>{total.toFixed(1)}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                      {futureMonths.map(mo => {
                        const total = projects.reduce((s, p) => s + (Number(p.cap[mo]) || 0), 0);
                        return (
                          <td key={mo} className="px-2 py-2.5 text-center border-l border-slate-100">
                            {total > 0
                              ? <span className={total > 1 ? 'text-red-600 font-bold' : 'text-slate-600'}>{total.toFixed(1)}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  </tfoot>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 mt-1.5">
                Cột xanh = tháng đã qua hoặc hiện tại · Đỏ = tổng &gt; 100% · Đơn vị: 1.0 = 100% effort
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function GlobalResourcesPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [filterDomain, setFilterDomain] = useState('All');
  const [loading, setLoading] = useState(true);
  const [detailPerson, setDetailPerson] = useState<PersonSummary | null>(null);

  useEffect(() => {
    fetch('/api/resources')
      .then(r => r.json())
      .then(data => { setMembers(Array.isArray(data) ? data : []); setLoading(false); });
  }, []);

  const now = new Date();
  const nowYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const domains = ['All', ...new Set(members.map(m => m.domain))].filter(Boolean).sort();

  const filtered = members.filter(m => {
    const matchDomain = filterDomain === 'All' || m.domain === filterDomain;
    const q = search.toLowerCase();
    const matchSearch = !q
      || m.name.toLowerCase().includes(q)
      || m.role.toLowerCase().includes(q)
      || m.project_name.toLowerCase().includes(q);
    return matchDomain && matchSearch;
  });

  // Build one PersonSummary per unique person
  const personMap = new Map<string, PersonSummary>();
  for (const m of filtered) {
    const key = m.name.trim().toLowerCase();
    if (!personMap.has(key)) {
      personMap.set(key, {
        name: m.name.trim(),
        role: m.role,
        domain: m.domain,
        projectCount: 0,
        capByMonth: {},
        capToDate: 0,
        maxLoad: 0,
        rows: [],
      });
    }
    const p = personMap.get(key)!;
    p.rows.push(m);
    p.projectCount += 1;
    try {
      const cap = JSON.parse(m.capacity_json || '{}') as Record<string, number>;
      for (const [mo, val] of Object.entries(cap)) {
        p.capByMonth[mo] = (p.capByMonth[mo] || 0) + Number(val);
        if (mo <= nowYM) p.capToDate += Number(val);
      }
    } catch { /* skip */ }
  }
  // compute maxLoad (peak monthly load across all months)
  for (const p of personMap.values()) {
    p.maxLoad = Object.values(p.capByMonth).reduce((mx, v) => Math.max(mx, v), 0);
  }

  // Group persons by domain
  const domainGroups = new Map<string, PersonSummary[]>();
  for (const p of personMap.values()) {
    const d = p.domain || 'Other';
    if (!domainGroups.has(d)) domainGroups.set(d, []);
    domainGroups.get(d)!.push(p);
  }
  const sortedDomains = [...domainGroups.keys()].sort();

  // Summary stats (from all members, not filtered)
  const totalPersons = new Set(members.map(m => m.name.trim().toLowerCase())).size;
  const allPersonMap = new Map<string, Record<string, number>>();
  for (const m of members) {
    const key = m.name.trim().toLowerCase();
    if (!allPersonMap.has(key)) allPersonMap.set(key, {});
    try {
      const cap = JSON.parse(m.capacity_json || '{}') as Record<string, number>;
      for (const [mo, val] of Object.entries(cap)) {
        allPersonMap.get(key)![mo] = (allPersonMap.get(key)![mo] || 0) + Number(val);
      }
    } catch { /* skip */ }
  }
  const overloaded = [...allPersonMap.values()].filter(cap => Object.values(cap).some(v => v > 1)).length;
  const underutilized = [...allPersonMap.values()].filter(cap => {
    const vals = Object.values(cap).filter(v => v > 0);
    return vals.length > 0 && vals.every(v => v < 0.3);
  }).length;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 overflow-x-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-800">Resource Management</h1>
            <p className="text-xs text-slate-400 mt-0.5">Tổng hợp capacity tất cả members across all projects</p>
          </div>
          <Link href="/portfolio/resources">
            <Button variant="outline" className="gap-2 h-9 text-sm">
              <Users className="h-4 w-4" /> Manage Members
            </Button>
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-slate-500 mb-1">Total Members</p>
            <p className="text-2xl font-bold text-slate-800">{totalPersons}</p>
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
            <SelectTrigger className="w-44 h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              {domains.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="text-slate-400 text-sm py-10">Loading...</p>
        ) : personMap.size === 0 ? (
          <p className="text-slate-400 text-sm py-10">No members found. Add members in individual project Resource Plans.</p>
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#1e293b] text-white">
                  <th className="px-4 py-3 text-left">Name</th>
                  <th className="px-4 py-3 text-left w-36">Role</th>
                  <th className="px-4 py-3 text-center w-28">Projects</th>
                  <th className="px-4 py-3 text-center w-32">Tổng đến nay</th>
                  <th className="px-4 py-3 text-left w-44">Total Load (peak)</th>
                  <th className="px-4 py-3 w-8"></th>
                </tr>
              </thead>
              <tbody>
                {sortedDomains.map(domain => {
                  const persons = domainGroups.get(domain) ?? [];
                  return (
                    <>
                      <tr key={`d-${domain}`}>
                        <td colSpan={6} className="px-4 py-2 bg-slate-100 font-semibold text-slate-600 text-[11px] uppercase tracking-wide border-t-2 border-slate-200">
                          {domain}
                        </td>
                      </tr>
                      {persons.map((p, i) => {
                        const isOver = p.maxLoad > 1.05;
                        return (
                          <tr
                            key={p.name}
                            onClick={() => setDetailPerson(p)}
                            className={`border-t cursor-pointer transition-colors ${isOver ? 'bg-red-50/40 hover:bg-red-50' : i % 2 === 1 ? 'bg-slate-50/50 hover:bg-blue-50/40' : 'hover:bg-blue-50/40'}`}
                          >
                            <td className="px-4 py-3 font-semibold text-slate-800">
                              <div className="flex items-center gap-2">
                                {isOver && <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />}
                                {p.name}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500">{p.role || '—'}</td>
                            <td className="px-4 py-3 text-center">
                              <span className="inline-flex items-center gap-1 text-slate-500">
                                {p.projectCount}
                                <span className="text-[10px] text-slate-400">proj</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-center">
                              {p.capToDate > 0 ? (
                                <span className="inline-block bg-blue-50 text-blue-700 font-bold rounded-lg px-3 py-1 text-[12px]">
                                  {p.capToDate.toFixed(1)} PM
                                </span>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <LoadBar value={p.maxLoad} />
                            </td>
                            <td className="px-4 py-3">
                              <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
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
        )}

        <p className="text-xs text-slate-400 mt-3">
          Click vào dòng để xem chi tiết phân bổ · Tổng đến nay = tổng person-months từ đầu đến tháng hiện tại · Peak load = tháng cao nhất
        </p>
      </main>

      <PersonDetailDialog person={detailPerson} onClose={() => setDetailPerson(null)} />
    </div>
  );
}
