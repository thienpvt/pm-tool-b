'use client';
import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Upload, ChevronRight, ChevronLeft, CheckCircle2, AlertCircle } from 'lucide-react';

type ColumnDef = { index: number; name: string; samples: string[] };

type FieldMap = { role: number; name: number; email: number; note: number };

type ParsedMember = { role: string; name: string; email: string; note: string };

const FIELD_LABELS: Record<keyof FieldMap, string> = {
  role: 'Role',
  name: 'Name *',
  email: 'Email',
  note: 'Note',
};

const FIELD_ALIASES: Record<keyof FieldMap, string[]> = {
  role: ['role', 'position', 'title', 'vai trò', 'chức danh', 'chuc danh'],
  name: ['name', 'fullname', 'full name', 'member', 'tên', 'ho ten', 'họ tên', 'nhân viên', 'nhan vien', 'resource', 'employee'],
  email: ['email', 'e-mail', 'mail', 'địa chỉ email', 'dia chi email'],
  note: ['note', 'notes', 'comment', 'remarks', 'ghi chú', 'ghi chu'],
};

function autoSuggest(columns: ColumnDef[]): FieldMap {
  const mapping: FieldMap = { role: -1, name: -1, email: -1, note: -1 };
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
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onImported: () => void;
}

export default function PortfolioImportDialog({ open, onOpenChange, onImported }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [columns, setColumns] = useState<ColumnDef[]>([]);
  const [allRows, setAllRows] = useState<string[][]>([]);
  const [fieldMap, setFieldMap] = useState<FieldMap>({ role: -1, name: -1, email: -1, note: -1 });
  const [parsed, setParsed] = useState<ParsedMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep(1);
    setColumns([]);
    setAllRows([]);
    setFieldMap({ role: -1, name: -1, email: -1, note: -1 });
    setParsed([]);
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
      setStep(2);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  };

  const applyMapping = useCallback(() => {
    const members: ParsedMember[] = [];
    for (const row of allRows) {
      const nameVal = fieldMap.name >= 0 ? (row[fieldMap.name] ?? '').trim() : '';
      if (!nameVal) continue;
      members.push({
        role: fieldMap.role >= 0 ? (row[fieldMap.role] ?? '').trim() : '',
        name: nameVal,
        email: fieldMap.email >= 0 ? (row[fieldMap.email] ?? '').trim() : '',
        note: fieldMap.note >= 0 ? (row[fieldMap.note] ?? '').trim() : '',
      });
    }
    setParsed(members);
    setStep(3);
  }, [allRows, fieldMap]);

  const handleSave = async () => {
    setSaving(true);
    try {
      let count = 0;
      for (const m of parsed) {
        const res = await fetch('/api/portfolio/members', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(m),
        });
        if (res.ok) count++;
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

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !saving) { reset(); onOpenChange(false); } }}>
      <DialogContent className="!max-w-3xl !w-[95vw] max-h-[90vh] flex flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-base">
            <Upload className="h-5 w-5 text-blue-500 shrink-0" />
            Import Resource Management
            <span className="text-sm font-normal text-slate-400">
              — Step {step} of 3:{' '}
              {step === 1 ? 'Upload File' : step === 2 ? 'Map Columns' : 'Preview & Save'}
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${step >= s ? 'bg-blue-500' : 'bg-slate-200'}`} />
          ))}
        </div>

        {/* Step 1: Upload */}
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
              <p className="text-xs text-slate-300 mt-1">Columns: Role, Name, Email, Note</p>
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

        {/* Step 2: Map Columns */}
        {step === 2 && (
          <div className="flex-1 overflow-auto space-y-5 pr-1">
            <div className="grid grid-cols-2 gap-5">
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

              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Map to Fields</p>
                <div className="space-y-2.5">
                  {(Object.keys(FIELD_LABELS) as (keyof FieldMap)[]).map(field => (
                    <div key={field} className="flex items-center gap-2">
                      <label className="w-20 text-xs text-slate-600 shrink-0 font-medium">{FIELD_LABELS[field]}</label>
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
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 3 && (
          <div className="flex-1 overflow-auto">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-xs text-slate-500">
                {parsed.length} member(s) found. Review below, then click Save.
              </span>
            </div>
            <div className="border rounded-lg overflow-auto">
              <table className="w-full text-xs min-w-max">
                <thead>
                  <tr className="bg-slate-800 text-white sticky top-0">
                    <th className="px-3 py-2.5 text-left w-8">#</th>
                    <th className="px-3 py-2.5 text-left w-32">Role</th>
                    <th className="px-3 py-2.5 text-left w-40">Name</th>
                    <th className="px-3 py-2.5 text-left w-48">Email</th>
                    <th className="px-3 py-2.5 text-left">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400">
                        No members found. Check that Name column is correctly mapped.
                      </td>
                    </tr>
                  ) : (
                    parsed.map((m, i) => (
                      <tr key={i} className={`border-t ${i % 2 ? 'bg-slate-50' : ''}`}>
                        <td className="px-3 py-1.5 text-slate-400">{i + 1}</td>
                        <td className="px-3 py-1.5 text-slate-600">{m.role || '—'}</td>
                        <td className="px-3 py-1.5 font-medium text-slate-800">{m.name}</td>
                        <td className="px-3 py-1.5 text-slate-500">{m.email || '—'}</td>
                        <td className="px-3 py-1.5 text-slate-400 max-w-[180px] truncate">{m.note || '—'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
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
