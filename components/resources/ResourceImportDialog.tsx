'use client';
import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Upload, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle, X } from 'lucide-react';

const MONTH_ABBR: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
};

function parseMonthFromHeader(text: string): string | null {
  if (!text) return null;
  const s = String(text).trim().replace(/\r/g, '');
  if (/^\d{4}-\d{2}$/.test(s)) return s;
  const parts = s.split(/[\n\s\-\/]+/).map(p => p.toLowerCase().trim());
  let month = '', year = '';
  for (const p of parts) {
    if (MONTH_ABBR[p.slice(0, 3)]) month = MONTH_ABBR[p.slice(0, 3)];
    if (/^20\d{2}$/.test(p)) year = p;
  }
  if (month && year) return `${year}-${month}`;
  return null;
}

type ColumnDef = { index: number; name: string; samples: string[] };

type FieldMap = { squad: number; role: number; name: number; notes: number };

type MonthCol = { colIndex: number; monthKey: string; colName: string };

type ParsedMember = { domain: string; role: string; name: string; capacity_json: string; notes: string };

const FIELD_LABELS: Record<keyof FieldMap, string> = {
  squad: 'Squad/Team',
  role: 'Role',
  name: 'Name *',
  notes: 'Notes',
};

const FIELD_ALIASES: Record<keyof FieldMap, string[]> = {
  squad: ['squad', 'team', 'domain', 'group', 'department', 'nhóm', 'squad/team', 'team/squad'],
  role: ['role', 'position', 'title', 'vai trò', 'chức danh'],
  name: ['name', 'fullname', 'full name', 'member', 'tên', 'họ tên', 'nhân viên', 'resource'],
  notes: ['notes', 'note', 'comment', 'remarks', 'ghi chú'],
};

function autoSuggest(columns: ColumnDef[]): FieldMap {
  const mapping: FieldMap = { squad: -1, role: -1, name: -1, notes: -1 };
  for (const col of columns) {
    const lower = col.name.toLowerCase().trim();
    for (const [field, aliasList] of Object.entries(FIELD_ALIASES) as [keyof FieldMap, string[]][]) {
      if (mapping[field] === -1 && aliasList.some(a => lower.includes(a))) {
        mapping[field] = col.index;
      }
    }
  }
  return mapping;
}

type Step = 1 | 2 | 3;

interface Props {
  projectId: string;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}

export default function ResourceImportDialog({ projectId, open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [fieldMap, setFieldMap] = useState<FieldMap>({ squad: -1, role: -1, name: -1, notes: -1 });
  const [monthCols, setMonthCols] = useState<MonthCol[]>([]);
  const [parsed, setParsed] = useState<ParsedMember[]>([]);
  const [parsedMonths, setParsedMonths] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1);
    setColumns([]);
    setAllRows([]);
    setFieldMap({ squad: -1, role: -1, name: -1, notes: -1 });
    setMonthCols([]);
    setParsed([]);
    setParsedMonths([]);
    setLoading(false);
    setSaving(false);
  };

  const handleFile = async (file: File) => {
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/parse-file-headers', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error ?? 'Parse failed'); return; }

      const cols: ColumnDef[] = (data.columns as string[]).map((name, i) => ({
        index: i,
        name,
        samples: (data.preview as string[][]).map((row: string[]) => row[i] ?? '').filter(Boolean).slice(0, 3),
      }));

      setColumns(cols);
      setAllRows(data.allRows ?? []);
      setFieldMap(autoSuggest(cols));

      // Auto-detect month columns
      const months: MonthCol[] = [];
      for (const col of cols) {
        const mk = parseMonthFromHeader(col.name);
        if (mk) months.push({ colIndex: col.index, monthKey: mk, colName: col.name });
      }
      setMonthCols(months);
      setStep(2);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  const applyMapping = useCallback(() => {
    const members: ParsedMember[] = [];
    const monthKeys = monthCols.map(m => m.monthKey).sort();

    const mappedColIndices = new Set([fieldMap.squad, fieldMap.role, fieldMap.name, fieldMap.notes].filter(i => i >= 0));

    for (const row of allRows) {
      const nameVal = fieldMap.name >= 0 ? (row[fieldMap.name] ?? '').trim() : '';
      if (!nameVal) continue;
      const squadVal = fieldMap.squad >= 0 ? (row[fieldMap.squad] ?? '').trim() : '';
      const roleVal = fieldMap.role >= 0 ? (row[fieldMap.role] ?? '').trim() : '';
      const notesVal = fieldMap.notes >= 0 ? (row[fieldMap.notes] ?? '').trim() : '';

      const cap: Record<string, number> = {};
      for (const mc of monthCols) {
        if (mappedColIndices.has(mc.colIndex)) continue;
        const raw = (row[mc.colIndex] ?? '').trim();
        const v = parseFloat(raw);
        if (!isNaN(v) && v > 0) cap[mc.monthKey] = v;
      }
      members.push({
        domain: squadVal || 'Other',
        role: roleVal,
        name: nameVal,
        capacity_json: JSON.stringify(cap),
        notes: notesVal,
      });
    }
    setParsed(members);
    setParsedMonths(monthKeys);
    setStep(3);
  }, [allRows, fieldMap, monthCols]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let count = 0;
      for (const m of parsed) {
        await fetch(`/api/projects/${projectId}/team`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(m),
        });
        count++;
      }
      toast.success(`Imported ${count} member(s)`);
      reset();
      onOpenChange(false);
      onImported();
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSaving(false);
    }
  };

  const updateMonthKey = (colIndex: number, newKey: string) => {
    setMonthCols(ms => ms.map(m => m.colIndex === colIndex ? { ...m, monthKey: newKey } : m));
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !saving) { reset(); onOpenChange(false); } }}>
      <DialogContent className="!max-w-4xl !w-[95vw] max-h-[92vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-base">
            <Upload className="h-5 w-5 text-blue-500 shrink-0" />
            Import Resource Plan
            <span className="text-sm font-normal text-slate-400">
              — Step {step} of 3:{' '}
              {step === 1 ? 'Upload File' : step === 2 ? 'Map Columns' : 'Preview & Save'}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* Progress bar */}
        <div className="flex gap-1">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-blue-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        {/* ── Step 1: Upload ── */}
        {step === 1 && (
          <div
            className={`flex-1 flex flex-col items-center justify-center gap-5 border-2 border-dashed rounded-xl p-14 cursor-pointer transition-colors ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'}`}
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className={`h-14 w-14 ${dragging ? 'text-blue-400' : 'text-slate-300'}`} />
            <div className="text-center pointer-events-none">
              <p className="text-slate-700 font-medium text-base">Drop file here or click to browse</p>
              <p className="text-sm text-slate-400 mt-1">Supports .xlsx, .xls, .csv</p>
              <p className="text-xs text-slate-300 mt-1">First row will be read as column headers</p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv,.txt"
              className="hidden"
              onClick={e => e.stopPropagation()}
              onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) handleFile(f); }}
            />
            {loading && <p className="text-sm text-blue-500 animate-pulse">Parsing file…</p>}
          </div>
        )}

        {/* ── Step 2: Map Columns ── */}
        {step === 2 && (
          <div className="flex-1 overflow-auto space-y-5 pr-1">
            <div className="grid grid-cols-2 gap-5">
              {/* Left: file columns */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  File Columns ({columns.length})
                </p>
                <div className="border rounded-lg divide-y max-h-64 overflow-y-auto bg-slate-50">
                  {columns.map(col => (
                    <div key={col.index} className="px-3 py-2">
                      <div className="font-medium text-xs text-slate-700">{col.name || `Column ${col.index + 1}`}</div>
                      {col.samples.map((s, i) => (
                        <div key={i} className="text-[10px] text-slate-400 truncate">{s}</div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              {/* Right: field mapping */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Map to Fields</p>
                <div className="space-y-2.5">
                  {(Object.keys(FIELD_LABELS) as (keyof FieldMap)[]).map(field => (
                    <div key={field} className="flex items-center gap-2">
                      <label className="w-24 text-xs text-slate-600 shrink-0 font-medium">{FIELD_LABELS[field]}</label>
                      <select
                        className="flex-1 text-xs border rounded px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                        value={fieldMap[field]}
                        onChange={e => setFieldMap(m => ({ ...m, [field]: Number(e.target.value) }))}
                      >
                        <option value={-1}>— not mapped —</option>
                        {columns.map(c => (
                          <option key={c.index} value={c.index}>{c.name || `Column ${c.index + 1}`}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
                {fieldMap.name < 0 && (
                  <p className="text-[11px] text-amber-600 mt-2 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" /> Name is required to identify members
                  </p>
                )}
              </div>
            </div>

            {/* Month columns */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                Month Columns — {monthCols.length} detected
              </p>
              {monthCols.length === 0 ? (
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  No month columns detected. Month column headers should be named like &quot;Jan 2025&quot;, &quot;2025-01&quot;, &quot;Feb-2026&quot;, etc.
                  You can add capacity data manually after import.
                </p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3 py-1.5 text-[10px] text-slate-400 font-medium grid grid-cols-[1fr_120px_60px] gap-2">
                    <span>Column Name</span><span>Month Key (YYYY-MM)</span><span></span>
                  </div>
                  <div className="divide-y max-h-44 overflow-y-auto">
                    {monthCols.map(mc => (
                      <div key={mc.colIndex} className="grid grid-cols-[1fr_120px_60px] gap-2 items-center px-3 py-1.5">
                        <span className="text-xs text-slate-600 truncate">{mc.colName}</span>
                        <Input
                          className="h-6 text-xs font-mono"
                          value={mc.monthKey}
                          onChange={e => updateMonthKey(mc.colIndex, e.target.value)}
                          placeholder="YYYY-MM"
                        />
                        <button
                          className="text-[10px] text-red-400 hover:text-red-600 text-right"
                          onClick={() => setMonthCols(ms => ms.filter(m => m.colIndex !== mc.colIndex))}
                        >
                          <X className="h-3.5 w-3.5 ml-auto" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Preview ── */}
        {step === 3 && (
          <div className="flex-1 overflow-auto">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-xs text-slate-500">
                {parsed.length} member(s) found. Review below, then click Save.
                Existing members will not be affected.
              </span>
            </div>
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-xs min-w-max">
                <thead>
                  <tr className="bg-slate-800 text-white sticky top-0">
                    <th className="px-3 py-2.5 text-left w-8">#</th>
                    <th className="px-3 py-2.5 text-left w-28">Squad/Team</th>
                    <th className="px-3 py-2.5 text-left w-32">Role</th>
                    <th className="px-3 py-2.5 text-left w-36">Name</th>
                    {parsedMonths.slice(0, 12).map(m => (
                      <th key={m} className="px-2 py-2.5 text-center w-14">
                        {new Date(m + '-01').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })}
                      </th>
                    ))}
                    <th className="px-3 py-2.5 text-left">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.length === 0 ? (
                    <tr>
                      <td colSpan={parsedMonths.length + 5} className="text-center py-8 text-slate-400">
                        No members found. Check that Name column is correctly mapped.
                      </td>
                    </tr>
                  ) : (
                    parsed.map((m, i) => {
                      const cap = JSON.parse(m.capacity_json || '{}') as Record<string, number>;
                      return (
                        <tr key={i} className={`border-t ${i % 2 ? 'bg-slate-50' : ''}`}>
                          <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                          <td className="px-3 py-1.5">
                            <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium text-[10px]">{m.domain}</span>
                          </td>
                          <td className="px-3 py-1.5 text-slate-600">{m.role || '—'}</td>
                          <td className="px-3 py-1.5 font-medium text-slate-800">{m.name}</td>
                          {parsedMonths.slice(0, 12).map(mo => {
                            const v = cap[mo];
                            return (
                              <td key={mo} className={`px-2 py-1.5 text-center font-mono ${v >= 1 ? 'text-red-600 font-bold' : v > 0 ? 'text-slate-700' : 'text-slate-200'}`}>
                                {v > 0 ? v : '—'}
                              </td>
                            );
                          })}
                          <td className="px-3 py-1.5 text-slate-400 max-w-[120px] truncate">{m.notes || '—'}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {parsedMonths.length > 12 && (
              <p className="text-[11px] text-slate-400 mt-2">
                Showing first 12 months · {parsedMonths.length} months total will be imported
              </p>
            )}
          </div>
        )}

        <DialogFooter className="pt-1 gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => (s - 1) as Step)} disabled={saving} className="gap-1">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          )}
          <div className="flex-1" />
          {step === 1 && (
            <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          )}
          {step === 2 && (
            <Button
              onClick={applyMapping}
              disabled={fieldMap.name < 0}
              className="bg-blue-600 hover:bg-blue-700 gap-1"
            >
              Preview <ChevronRight className="h-4 w-4" />
            </Button>
          )}
          {step === 3 && (
            <Button
              onClick={handleSave}
              disabled={saving || parsed.length === 0}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {saving ? 'Saving…' : `Save ${parsed.length} Member${parsed.length !== 1 ? 's' : ''}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
