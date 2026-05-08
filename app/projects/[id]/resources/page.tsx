'use client';
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, Copy, ChevronLeft, ChevronRight, Download, CheckCircle2, AlertCircle } from 'lucide-react';

type ParsedMember = { domain: string; role: string; name: string; capacity_json: string; notes: string; };

type TeamMember = {
  id: number; domain: string; role: string; name: string;
  capacity_json: string; notes: string;
};

type GlobalMember = TeamMember & {
  project_id: number; project_name: string;
};

type Project = { id: number; name: string; };

const DOMAINS = ['PM', 'SA', 'BA', 'DevOps', 'Backend', 'Frontend', 'Mobile', 'QA', 'Data', 'UI/UX', 'Other'];
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function yearMonths(year: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
}

function displayMonth(ym: string) {
  const m = Number(ym.split('-')[1]);
  return MONTH_NAMES[m - 1];
}

function capacityColor(val: number) {
  if (val >= 1) return 'text-red-600 font-bold';
  if (val >= 0.7) return 'text-amber-600 font-medium';
  return 'text-slate-700';
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

export default function ResourcesPage() {
  const { id } = useParams<{ id: string }>();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [globalMembers, setGlobalMembers] = useState<GlobalMember[]>([]);
  const [year, setYear] = useState(new Date().getFullYear());

  // Export / Import dialogs
  const [exporting, setExporting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importParsed, setImportParsed] = useState<ParsedMember[]>([]);
  const [importMonths, setImportMonths] = useState<string[]>([]);
  const [importParsing, setImportParsing] = useState(false);
  const [importSaving, setImportSaving] = useState(false);
  const [copyOpen, setCopyOpen] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [srcProjectId, setSrcProjectId] = useState('');
  const [srcMembers, setSrcMembers] = useState<TeamMember[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [mRes, gRes] = await Promise.all([
      fetch(`/api/projects/${id}/team`).then(r => r.json()),
      fetch('/api/resources').then(r => r.json()),
    ]);
    setMembers(mRes);
    setGlobalMembers(Array.isArray(gRes) ? gRes : []);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // 12 months of the selected year
  const months = useMemo(() => yearMonths(year), [year]);

  // Years that already have capacity data (to highlight in selector)
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

  // Build cross-project capacity map: name → month → [{project_name, cap}]
  const crossCapMap = useMemo(() => {
    const map: Record<string, Record<string, { project_name: string; cap: number }[]>> = {};
    for (const gm of globalMembers) {
      if (String(gm.project_id) === id) continue; // skip current project
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

  // Load all projects for copy-from feature
  useEffect(() => {
    fetch('/api/projects').then(r => r.json()).then((data: Project[]) => {
      setAllProjects((data || []).filter((p: Project) => String(p.id) !== id));
    });
  }, [id]);

  // When source project changes, load its members
  useEffect(() => {
    if (!srcProjectId) { setSrcMembers([]); return; }
    fetch(`/api/projects/${srcProjectId}/team`).then(r => r.json()).then(setSrcMembers);
  }, [srcProjectId]);

  const addMember = async () => {
    const res = await fetch(`/api/projects/${id}/team`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'Backend', role: 'Developer', name: 'New Member', capacity_json: '{}' }),
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

  // ── XLSX Import ────────────────────────────────────────────────────────────
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setImportParsing(true);
    setImportOpen(false);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`/api/import/resource-plan/${id}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Parse failed'); return; }
      setImportParsed(data.members);
      setImportMonths(data.monthColumns ?? []);
      setPreviewOpen(true);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setImportParsing(false);
    }
  };

  const handleImportSave = async () => {
    setImportSaving(true);
    try {
      let count = 0;
      for (const m of importParsed) {
        await fetch(`/api/projects/${id}/team`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(m),
        });
        count++;
      }
      toast.success(`Imported ${count} member(s)`);
      setPreviewOpen(false);
      setImportParsed([]);
      setImportMonths([]);
      load();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setImportSaving(false);
    }
  };

  // ── Copy from project ─────────────────────────────────────────────────────
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

  const grouped = DOMAINS.reduce<Record<string, TeamMember[]>>((acc, d) => {
    const list = members.filter(m => m.domain === d);
    if (list.length) acc[d] = list;
    return acc;
  }, {});
  const ungrouped = members.filter(m => !DOMAINS.includes(m.domain));
  if (ungrouped.length) grouped['Other'] = [...(grouped['Other'] ?? []), ...ungrouped];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-4 lg:p-6 overflow-x-auto">
        <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-slate-800">Resource Plan</h1>
            {/* Year navigator */}
            <div className="flex items-center gap-1 bg-white border rounded-lg px-1 py-0.5 shadow-sm">
              <button
                onClick={() => setYear(y => y - 1)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                value={year}
                onChange={e => setYear(Number(e.target.value))}
                className="text-sm font-semibold text-slate-700 bg-transparent px-1 cursor-pointer focus:outline-none"
              >
                {Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>
                    {y}{yearsWithData.has(y) ? ' ●' : ''}
                  </option>
                ))}
              </select>
              <button
                onClick={() => setYear(y => y + 1)}
                className="p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
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
              onClick={() => fileInputRef.current?.click()}
              disabled={importParsing}
              className="gap-2 h-9 text-sm"
            >
              <Upload className={`h-4 w-4 ${importParsing ? 'animate-spin' : ''}`} />
              {importParsing ? 'Parsing...' : 'Import .xlsx'}
            </Button>
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
            <Button onClick={addMember} className="bg-blue-600 hover:bg-blue-700 gap-2 h-9 text-sm">
              <Plus className="h-4 w-4" /> Add Member
            </Button>
          </div>
        </div>

        <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-max">
              <thead>
                <tr className="bg-[#1e293b] text-white">
                  <th className="px-3 py-3 text-left w-24">Domain</th>
                  <th className="px-3 py-3 text-left w-32">Role</th>
                  <th className="px-3 py-3 text-left w-36">Name</th>
                  {months.map(m => (
                    <th key={m} className="px-2 py-3 text-center w-20">{displayMonth(m)}</th>
                  ))}
                  <th className="px-3 py-3 text-left w-40">Notes</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {members.length === 0 ? (
                  <tr><td colSpan={months.length + 5} className="text-center py-12 text-slate-400">
                    No team members. Click "Add Member" or "Import .xlsx".
                  </td></tr>
                ) : (
                  Object.entries(grouped).map(([domain, rows]) => (
                    <React.Fragment key={domain}>
                      <tr key={`header-${domain}`} className="bg-[#D6E4F0]">
                        <td colSpan={months.length + 5} className="px-3 py-1.5 font-semibold text-[#1A3A5C] text-xs uppercase tracking-wide">
                          {domain}
                        </td>
                      </tr>
                      {rows.map((row, i) => {
                        const cap = JSON.parse(row.capacity_json || '{}');
                        const otherProjects = crossCapMap[row.name] ?? {};
                        return (
                          <tr key={row.id} className={`border-t hover:bg-slate-50 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                            <td className="px-3 py-2">
                              <select className="text-xs border rounded px-1 py-0.5 w-full bg-white" value={row.domain}
                                onChange={e => updateField(row.id, 'domain', e.target.value)}
                                onBlur={() => saveRow(row)}>
                                {DOMAINS.map(d => <option key={d} value={d}>{d}</option>)}
                              </select>
                            </td>
                            <td className="px-3 py-2">
                              <Input className="h-6 text-xs" value={row.role} onChange={e => updateField(row.id, 'role', e.target.value)} onBlur={() => saveRow(row)} />
                            </td>
                            <td className="px-3 py-2">
                              <Input className="h-6 text-xs font-medium" value={row.name} onChange={e => updateField(row.id, 'name', e.target.value)} onBlur={() => saveRow(row)} />
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
                                  {/* Cross-project total bar */}
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
          Capacity: 1.0 = 100% (full-time) · 0.5 = 50% · Red border = overloaded in this project · Bar shows <strong>total across all projects</strong> (matched by name) · ⚠ = overallocated globally · Switch year to view / enter data for other years — data is preserved across all years
        </p>
      </main>

      {/* ── Import Preview Dialog ─────────────────────────────────────────── */}
      <Dialog open={previewOpen} onOpenChange={o => { if (!o && !importSaving) { setPreviewOpen(false); setImportParsed([]); setImportMonths([]); } }}>
        <DialogContent className="!max-w-[98vw] !w-[98vw] max-h-[92vh] h-[92vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              Preview Import — {importParsed.length} member{importParsed.length !== 1 ? 's' : ''} found
            </DialogTitle>
          </DialogHeader>

          <div className="text-xs text-slate-500 flex items-center gap-2 px-1">
            <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            Review the data below, then click <strong>Save</strong> to add these members to the project.
            Existing members will not be affected.
          </div>

          {/* Preview table */}
          <div className="flex-1 overflow-auto border rounded-lg">
            <table className="w-full text-xs min-w-max">
              <thead className="sticky top-0 z-10">
                <tr className="bg-slate-800 text-white">
                  <th className="px-3 py-2.5 text-left w-8">#</th>
                  <th className="px-3 py-2.5 text-left w-28">Domain</th>
                  <th className="px-3 py-2.5 text-left w-36">Role</th>
                  <th className="px-3 py-2.5 text-left w-36">Name</th>
                  {importMonths.slice(0, 12).map(m => (
                    <th key={m} className="px-2 py-2.5 text-center w-16">
                      {new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                    </th>
                  ))}
                  <th className="px-3 py-2.5 text-left">Notes</th>
                </tr>
              </thead>
              <tbody>
                {importParsed.map((m, i) => {
                  const cap = JSON.parse(m.capacity_json || '{}') as Record<string, number>;
                  return (
                    <tr key={i} className={`border-t ${i % 2 === 0 ? '' : 'bg-slate-50'}`}>
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      <td className="px-3 py-2">
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-medium">{m.domain}</span>
                      </td>
                      <td className="px-3 py-2 text-slate-600">{m.role}</td>
                      <td className="px-3 py-2 font-medium text-slate-800">{m.name}</td>
                      {importMonths.slice(0, 12).map(mo => {
                        const v = cap[mo];
                        return (
                          <td key={mo} className={`px-2 py-2 text-center font-mono ${v >= 1 ? 'text-red-600 font-bold' : v > 0 ? 'text-slate-700' : 'text-slate-200'}`}>
                            {v > 0 ? v : '—'}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-slate-400 max-w-[120px] truncate">{m.notes || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {importMonths.length > 12 && (
            <p className="text-[11px] text-slate-400 px-1">
              Showing first 12 months · {importMonths.length} months total will be imported
            </p>
          )}

          <DialogFooter className="pt-2">
            <Button
              variant="outline"
              onClick={() => { setPreviewOpen(false); setImportParsed([]); setImportMonths([]); }}
              disabled={importSaving}
            >
              Cancel
            </Button>
            <Button
              onClick={handleImportSave}
              disabled={importSaving}
              className="bg-blue-600 hover:bg-blue-700 gap-2"
            >
              {importSaving ? 'Saving...' : `Save ${importParsed.length} Members`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Copy from Project Dialog ──────────────────────────────────────── */}
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
