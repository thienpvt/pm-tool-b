'use client';
import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, ChevronLeft, ChevronRight, Download, Filter, Target } from 'lucide-react';
import ResourceImportDialog from '@/components/resources/ResourceImportDialog';

type TeamMember = {
  id: number; domain: string; role: string; name: string;
  capacity_json: string; notes: string;
};

type GlobalMember = TeamMember & {
  project_id: number; project_name: string;
};

type PortfolioMember = {
  id: number; role: string; name: string; email: string; note: string;
};

type Project = { id: number; name: string; headcount_quota?: number; };

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function yearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

function displayMonth(ym: string) {
  const m = Number(ym.split('-')[1]);
  return MONTH_NAMES[m - 1];
}

function totalCapColor(total: number) {
  if (total > 1.0) return 'text-red-600 font-bold';
  if (total >= 0.9) return 'text-amber-600 font-medium';
  return 'text-green-600';
}

function totalBarColor(total: number) {
  if (total > 1.0) return 'bg-red-500';
  if (total >= 0.9) return 'bg-amber-400';
  return 'bg-green-400';
}

// ── Name autocomplete input with portfolio member suggestions ──────────────────
function MemberNameInput({
  value,
  portfolioMembers,
  onChange,
  onSelectMember,
  onBlur,
}: {
  value: string;
  portfolioMembers: PortfolioMember[];
  onChange: (v: string) => void;
  onSelectMember: (name: string, role: string) => void;
  onBlur: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const suggestions = useMemo(() => {
    if (!value.trim() || portfolioMembers.length === 0) return [];
    const q = value.toLowerCase();
    return portfolioMembers
      .filter(m => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q))
      .slice(0, 8);
  }, [value, portfolioMembers]);

  const updatePos = () => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect();
      setDropPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 224) });
    }
  };

  const handleFocus = () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    updatePos();
    setOpen(true);
  };

  const handleBlur = () => {
    blurTimer.current = setTimeout(() => {
      setOpen(false);
      onBlur();
    }, 150);
  };

  const handleSelect = (m: PortfolioMember) => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
    setOpen(false);
    onSelectMember(m.name, m.role);
  };

  const dropdown = open && suggestions.length > 0
    ? createPortal(
        <div
          className="fixed z-[9999] bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden"
          style={{ top: dropPos.top, left: dropPos.left, width: dropPos.width }}
        >
          {suggestions.map(m => (
            <button
              key={m.id}
              type="button"
              className="w-full text-left px-3 py-1.5 hover:bg-blue-50 transition-colors"
              onMouseDown={() => handleSelect(m)}
            >
              <div className="text-xs font-medium text-slate-800 truncate">{m.name}</div>
              <div className="text-[10px] text-slate-400 truncate">
                {m.role}{m.email ? ` · ${m.email}` : ''}
              </div>
            </button>
          ))}
        </div>,
        document.body
      )
    : null;

  return (
    <>
      <Input
        ref={inputRef}
        className="h-6 text-xs font-medium"
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={handleFocus}
        onBlur={handleBlur}
      />
      {dropdown}
    </>
  );
}

export default function ResourcesPage() {
  const { id } = useParams<{ id: string }>();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [globalMembers, setGlobalMembers] = useState<GlobalMember[]>([]);
  const [portfolioMembers, setPortfolioMembers] = useState<PortfolioMember[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());
  const [squadFilter, setSquadFilter] = useState('');

  const [projectQuota, setProjectQuota] = useState(0);
  const [quotaSaving, setQuotaSaving] = useState(false);

  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [copyOpen, setCopyOpen] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [srcProjectId, setSrcProjectId] = useState('');
  const [srcMembers, setSrcMembers] = useState<TeamMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const load = useCallback(async () => {
    const [mRes, gRes, pRes] = await Promise.all([
      fetch(`/api/projects/${id}/team`).then(r => r.json()),
      fetch('/api/resources').then(r => r.json()),
      fetch(`/api/projects/${id}`).then(r => r.json()),
    ]);
    setMembers(mRes);
    setGlobalMembers(Array.isArray(gRes) ? gRes : []);
    setProjectQuota(pRes?.headcount_quota ?? 0);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    fetch('/api/portfolio/members')
      .then(r => r.json())
      .then(data => setPortfolioMembers(Array.isArray(data) ? data : []));
  }, []);

  const months = useMemo(() => yearMonths(year), [year]);

  const yearsWithData = useMemo(() => {
    const ys = new Set<number>();
    for (const m of members) {
      try {
        Object.keys(JSON.parse(m.capacity_json || '{}')).forEach(k => {
          const y = Number(k.split('-')[0]);
          if (y) ys.add(y);
        });
      } catch { /* skip */ }
    }
    return ys;
  }, [members]);

  const allSquads = useMemo(() => {
    const seen = new Set<string>();
    members.forEach(m => { if (m.domain) seen.add(m.domain); });
    return Array.from(seen).sort();
  }, [members]);

  const crossCapMap = useMemo(() => {
    const map: Record<string, Record<string, { project_name: string; cap: number }[]>> = {};
    for (const gm of globalMembers) {
      if (String(gm.project_id) === id) continue;
      const cap = JSON.parse(gm.capacity_json || '{}') as Record<string, number>;
      for (const [month, val] of Object.entries(cap)) {
        if (!val) continue;
        if (!map[gm.name]) map[gm.name] = {};
        if (!map[gm.name][month]) map[gm.name][month] = [];
        map[gm.name][month].push({ project_name: gm.project_name, cap: val });
      }
    }
    return map;
  }, [globalMembers, id]);

  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then((data: Project[]) => {
      setAllProjects((data || []).filter((p: Project) => String(p.id) !== id));
    });
  }, [id]);

  useEffect(() => {
    if (!srcProjectId) { setSrcMembers([]); return; }
    fetch(`/api/projects/${srcProjectId}/team`).then(r => r.json()).then(setSrcMembers);
  }, [srcProjectId]);

  const filteredMembers = useMemo(() => {
    if (!squadFilter) return members;
    return members.filter(m => m.domain === squadFilter);
  }, [members, squadFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, TeamMember[]> = {};
    for (const m of filteredMembers) {
      const squad = m.domain || 'Other';
      if (!map[squad]) map[squad] = [];
      map[squad].push(m);
    }
    return map;
  }, [filteredMembers]);

  const addMember = async () => {
    const res = await fetch(`/api/projects/${id}/team`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: '', role: '', name: 'New Member', capacity_json: '{}' }),
    });
    res.json().then((row: TeamMember) => setMembers(m => [...m, row]));
  };

  const updateField = (memberId: number, field: string, value: string) => {
    setMembers(m => m.map(r => r.id === memberId ? { ...r, [field]: value } : r));
  };

  const updateCapacity = (memberId: number, month: string, value: string) => {
    setMembers(m => m.map(r => {
      if (r.id !== memberId) return r;
      const cap = JSON.parse(r.capacity_json || '{}');
      if (value === '' || value === '0') delete cap[month];
      else cap[month] = parseFloat(value) || 0;
      return { ...r, capacity_json: JSON.stringify(cap) };
    }));
  };

  const saveRow = async (row: TeamMember) => {
    await fetch(`/api/projects/${id}/team`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    });
  };

  const deleteRow = async (memberId: number) => {
    await fetch(`/api/projects/${id}/team?rowId=${memberId}`, { method: 'DELETE' });
    setMembers(m => m.filter(r => r.id !== memberId));
  };

  const saveProjectQuota = async (value: number) => {
    if (quotaSaving) return;
    setQuotaSaving(true);
    try {
      await fetch(`/api/projects/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headcount_quota: value }),
      });
    } finally {
      setQuotaSaving(false);
    }
  };

  const exportExcel = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/api/export/resource-plan/${id}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ResourcePlan_${id}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Resource plan exported!');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setExporting(false);
    }
  };

  const handleCopyMembers = async () => {
    if (selectedIds.size === 0) { toast.error('Select at least one member'); return; }
    const toCopy = srcMembers.filter(m => selectedIds.has(m.id));
    let count = 0;
    for (const m of toCopy) {
      await fetch(`/api/projects/${id}/team`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: m.domain, role: m.role, name: m.name, capacity_json: '{}' }),
      });
      count++;
    }
    toast.success(`Copied ${count} member(s)`);
    setCopyOpen(false);
    setSrcProjectId('');
    setSelectedIds(new Set());
    load();
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-4 lg:p-6 overflow-x-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-slate-800">Resource Plan</h1>

            {/* Year navigator */}
            <div className="flex items-center gap-1 bg-white border rounded-lg px-1 py-0.5 shadow-sm">
              <button onClick={() => setYear(y => y - 1)} className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="text-sm font-semibold text-slate-700 bg-transparent px-1 cursor-pointer focus:outline-none"
              >
                {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}{yearsWithData.has(y) ? ' ●' : ''}</option>
                ))}
              </select>
              <button onClick={() => setYear(y => y + 1)} className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Squad/Team filter */}
            {allSquads.length > 0 && (
              <div className="flex items-center gap-1.5 bg-white border rounded-lg px-2 py-1 shadow-sm">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select
                  value={squadFilter}
                  onChange={e => setSquadFilter(e.target.value)}
                  className="text-xs text-slate-700 bg-transparent focus:outline-none cursor-pointer pr-1"
                >
                  <option value="">All Squads</option>
                  {allSquads.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={exportExcel}
              disabled={exporting || members.length === 0}
              className="gap-2 h-9 text-sm text-emerald-700 border-emerald-300 hover:bg-emerald-50"
            >
              <Download className={`h-4 w-4 ${exporting ? 'animate-bounce' : ''}`} />
              {exporting ? 'Exporting...' : 'Export .xlsx'}
            </Button>
            <Button variant="outline" onClick={() => setCopyOpen(true)} className="gap-2 h-9 text-sm">
              <Copy className="h-4 w-4" /> Copy from Project
            </Button>
            <Button
              variant="outline"
              onClick={() => setImportOpen(true)}
              className="gap-2 h-9 text-sm"
            >
              Import
            </Button>
            <Button onClick={addMember} className="bg-blue-600 hover:bg-blue-700 gap-2 h-9 text-sm">
              <Plus className="h-4 w-4" /> Add Member
            </Button>
          </div>
        </div>

        {/* Quota summary bar */}
        {(() => {
          const actual = members.length;
          const remaining = projectQuota - actual;
          const pct = projectQuota > 0 ? Math.min((actual / projectQuota) * 100, 100) : 0;
          const over = remaining < 0;
          const atLimit = remaining === 0 && projectQuota > 0;
          return (
            <div className="flex items-center gap-4 flex-wrap bg-slate-50 border rounded-xl px-4 py-3 mb-4">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-xs text-slate-500 font-medium">Định biên KH:</span>
                <input
                  type="number"
                  min={0}
                  className="w-16 h-6 px-1.5 text-xs font-bold text-slate-800 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center bg-white"
                  value={projectQuota || ''}
                  placeholder="0"
                  onChange={e => setProjectQuota(Math.max(0, Number(e.target.value) || 0))}
                  onBlur={() => saveProjectQuota(projectQuota)}
                />
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="text-xs">
                <span className="text-slate-400">Thực tế: </span>
                <span className="font-bold text-slate-700">{actual} nhân sự</span>
              </div>
              <div className="h-4 w-px bg-slate-200" />
              <div className="text-xs">
                <span className="text-slate-400">Độ phủ: </span>
                <span className={`font-bold ${over ? 'text-blue-600' : atLimit ? 'text-green-600' : projectQuota === 0 ? 'text-slate-400' : 'text-amber-600'}`}>
                  {projectQuota > 0 ? `${pct.toFixed(0)}%` : '—'}
                </span>
              </div>
              {projectQuota > 0 && (
                <>
                  <div className="h-4 w-px bg-slate-200" />
                  <div className="flex items-center gap-2 flex-1 min-w-[120px]">
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${over ? 'bg-blue-500' : pct >= 100 ? 'bg-green-500' : pct >= 70 ? 'bg-amber-400' : 'bg-slate-400'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-slate-500 tabular-nums">{actual}/{projectQuota}</span>
                  </div>
                  <div className="h-4 w-px bg-slate-200" />
                  <div className="text-xs">
                    <span className="text-slate-400">Còn thiếu: </span>
                    <span className={`font-bold ${remaining <= 0 ? 'text-green-600' : 'text-amber-600'}`}>
                      {remaining <= 0 ? 'Đủ định biên' : `${remaining} người`}
                    </span>
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Table */}
        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="bg-[#1e293b] text-white">
                  <th className="px-3 py-3 text-left w-28">Squad/Team</th>
                  <th className="px-3 py-3 text-left w-32">Role</th>
                  <th className="px-3 py-3 text-left w-44">Name</th>
                  {months.map(m => (
                    <th key={m} className="px-2 py-3 text-center w-20">{displayMonth(m)}</th>
                  ))}
                  <th className="px-3 py-3 text-left w-40">Notes</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr>
                    <td colSpan={months.length + 5} className="text-center py-12 text-slate-400">
                      No team members. Click &quot;Add Member&quot; or &quot;Import&quot;.
                    </td>
                  </tr>
                ) : Object.keys(grouped).length === 0 ? (
                  <tr>
                    <td colSpan={months.length + 5} className="text-center py-8 text-slate-400">
                      No members match the current filter.
                    </td>
                  </tr>
                ) : (
                  Object.entries(grouped).map(([squad, rows]) => (
                    <React.Fragment key={squad}>
                      <tr className="bg-[#D6E4F0]">
                        <td colSpan={months.length + 5} className="px-3 py-1.5 font-semibold text-[#1A3A5C] text-xs uppercase tracking-wide">
                          {squad || 'No Squad'}
                        </td>
                      </tr>
                      {rows.map((row, i) => {
                        const cap = JSON.parse(row.capacity_json || '{}');
                        const otherProjects = crossCapMap[row.name] ?? {};
                        return (
                          <tr key={row.id} className={`border-t hover:bg-slate-50 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                            <td className="px-3 py-2">
                              <Input
                                className="h-6 text-xs"
                                value={row.domain}
                                placeholder="Squad/Team"
                                onChange={e => updateField(row.id, 'domain', e.target.value)}
                                onBlur={() => saveRow(row)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <Input
                                className="h-6 text-xs"
                                value={row.role}
                                placeholder="Role"
                                onChange={e => updateField(row.id, 'role', e.target.value)}
                                onBlur={() => saveRow(row)}
                              />
                            </td>
                            <td className="px-3 py-2">
                              <MemberNameInput
                                value={row.name}
                                portfolioMembers={portfolioMembers}
                                onChange={v => updateField(row.id, 'name', v)}
                                onSelectMember={(name, role) => {
                                  setMembers(ms => ms.map(r =>
                                    r.id === row.id ? { ...r, name, role: role || r.role } : r
                                  ));
                                  setTimeout(() => {
                                    const updated = { ...row, name, role: role || row.role };
                                    saveRow(updated);
                                  }, 0);
                                }}
                                onBlur={() => saveRow(row)}
                              />
                            </td>
                            {months.map(m => {
                              const val = cap[m] ?? 0;
                              const otherEntries = otherProjects[m] ?? [];
                              const otherTotal = otherEntries.reduce((s, e) => s + e.cap, 0);
                              const grandTotal = val + otherTotal;
                              const isOverloaded = grandTotal > 1.0;
                              const tooltipLines = otherEntries.map(e => `${e.project_name}: ${(e.cap * 100).toFixed(0)}%`).join('\n');
                              return (
                                <td key={m} className={`px-2 py-1.5 text-center ${isOverloaded ? 'bg-red-50/60' : ''}`}>
                                  <Input
                                    className={`h-6 text-xs text-center w-14 mx-auto px-1 ${val >= 1 ? 'border-red-300 bg-red-50' : val >= 0.7 ? 'border-amber-200 bg-amber-50' : ''}`}
                                    type="number" min={0} max={2} step={0.1}
                                    value={val > 0 ? val : ''}
                                    placeholder="—"
                                    onChange={e => updateCapacity(row.id, m, e.target.value)}
                                    onBlur={() => saveRow(row)}
                                  />
                                  {grandTotal > 0 && (
                                    <div className="mt-1 px-0.5" title={otherEntries.length > 0 ? `This project: ${(val*100).toFixed(0)}%\n${tooltipLines}\nTotal: ${(grandTotal*100).toFixed(0)}%` : ''}>
                                      <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${totalBarColor(grandTotal)}`}
                                          style={{ width: `${Math.min(grandTotal * 100, 100)}%` }}
                                        />
                                      </div>
                                      <div className={`text-[9px] mt-0.5 font-medium ${totalCapColor(grandTotal)}`}>
                                        {isOverloaded && '⚠ '}{(grandTotal * 100).toFixed(0)}%
                                        {otherEntries.length > 0 && <span className="text-slate-400 font-normal"> total</span>}
                                      </div>
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-3 py-2">
                              <Input className="h-6 text-xs" value={row.notes} onChange={e => updateField(row.id, 'notes', e.target.value)} onBlur={() => saveRow(row)} />
                            </td>
                            <td className="px-3 py-2">
                              <button onClick={() => deleteRow(row.id)} className="text-slate-300 hover:text-red-500 transition-colors">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">
          Capacity: 1.0 = 100% (full-time) · 0.5 = 50% · Red border = overloaded in this project · Bar shows <strong>total across all projects</strong> (matched by name) · ⚠ = overallocated globally · Gõ tên hoặc email để chọn nhân sự từ Portfolio
        </p>
      </main>

      {/* Import Dialog */}
      <ResourceImportDialog
        projectId={id}
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={load}
      />

      {/* Copy from Project Dialog */}
      <Dialog open={copyOpen} onOpenChange={o => { if (!o) { setCopyOpen(false); setSrcProjectId(''); setSelectedIds(new Set()); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Copy Members from Another Project</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Source Project</Label>
              <select
                className="w-full mt-1.5 text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={srcProjectId}
                onChange={e => { setSrcProjectId(e.target.value); setSelectedIds(new Set()); }}
              >
                <option value="">— Select a project —</option>
                {allProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {srcMembers.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Select Members ({selectedIds.size} selected)</Label>
                  <button
                    className="text-xs text-blue-600 hover:underline"
                    onClick={() => setSelectedIds(new Set(srcMembers.map(m => m.id)))}
                  >
                    Select All
                  </button>
                </div>
                <div className="border rounded-lg divide-y max-h-56 overflow-y-auto">
                  {srcMembers.map(m => (
                    <label key={m.id} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(m.id)}
                        onChange={e => {
                          const next = new Set(selectedIds);
                          e.target.checked ? next.add(m.id) : next.delete(m.id);
                          setSelectedIds(next);
                        }}
                      />
                      <div>
                        <span className="text-sm font-medium text-slate-800">{m.name}</span>
                        <span className="text-xs text-slate-400 ml-2">{m.domain} · {m.role}</span>
                      </div>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-1">Capacity data will not be copied — please fill it manually.</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCopyOpen(false); setSrcProjectId(''); setSelectedIds(new Set()); }}>Cancel</Button>
            <Button onClick={handleCopyMembers} disabled={selectedIds.size === 0} className="bg-blue-600 hover:bg-blue-700">
              Copy {selectedIds.size > 0 ? `(${selectedIds.size})` : ''} Members
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
