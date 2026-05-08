'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Save, Trash2, ChevronRight, ChevronLeft, FileSpreadsheet, Check, Calendar, Users, BarChart2, AlertTriangle, FileText, Info } from 'lucide-react';

// ─── Activity fields definition ───────────────────────────────────────────────
export const ACTIVITY_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'activity', label: 'Activity', required: true },
  { key: 'phase',    label: 'Phase' },
  { key: 'no',       label: 'No' },
  { key: 'deliverable',  label: 'Deliverable' },
  { key: 'sign_off_doc', label: 'Sign-off Document' },
  { key: 'accountable',  label: 'Accountable' },
  { key: 'responsible',  label: 'Responsible' },
  { key: 'support',      label: 'Support' },
  { key: 'plan_start',   label: 'Plan Start (YYYY-MM-DD)' },
  { key: 'plan_end',     label: 'Plan End (YYYY-MM-DD)' },
  { key: 'actual_start', label: 'Actual Start (YYYY-MM-DD)' },
  { key: 'actual_end',   label: 'Actual End (YYYY-MM-DD)' },
  { key: 'status',       label: 'Status' },
  { key: 'completion_pct', label: 'Completion (%)' },
  { key: 'delay_owner',   label: 'Delay Owner' },
  { key: 'delay_reason',  label: 'Delay Reason' },
  { key: 'notes',         label: 'Notes' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  no:             ['no', 'num', 'number', 'seq', 'stt', '#'],
  phase:          ['phase', 'stage', 'category', 'giai doan'],
  activity:       ['activity', 'task', 'name', 'ten', 'title', 'description', 'cong viec', 'job'],
  deliverable:    ['deliverable', 'output', 'dau ra', 'result', 'artifact'],
  sign_off_doc:   ['sign off', 'signoff', 'sign-off', 'document', 'doc', 'bien ban'],
  accountable:    ['accountable', 'owner', 'account', 'chu tri'],
  responsible:    ['responsible', 'person', 'assignee', 'phu trach'],
  support:        ['support', 'ho tro', 'helper'],
  plan_start:     ['plan start', 'planned start', 'start', 'begin', 'bat dau', 'ke hoach bat dau', 'start date'],
  plan_end:       ['plan end', 'planned end', 'end', 'finish', 'ket thuc', 'ke hoach ket thuc', 'end date', 'due date'],
  actual_start:   ['actual start', 'real start', 'thuc te bat dau', 'actual start date'],
  actual_end:     ['actual end', 'real end', 'thuc te ket thuc', 'actual end date'],
  status:         ['status', 'trang thai', 'state', 'tinh trang'],
  completion_pct: ['completion', 'percent', '%', 'progress', 'tien do', 'done', 'pct', 'complete'],
  delay_owner:    ['delay owner', 'owner delay', 'responsible for delay'],
  delay_reason:   ['delay reason', 'reason', 'ly do', 'cause'],
  notes:          ['notes', 'note', 'remark', 'ghi chu', 'comment', 'observation'],
};

function autoSuggestMapping(columns: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const col of columns) {
      const normCol = normalize(col);
      if (aliases.some(a => normCol === a || normCol.includes(a) || a.includes(normCol))) {
        if (!result[field]) result[field] = col;
      }
    }
  }
  return result;
}

// ─── Types ────────────────────────────────────────────────────────────────────
type SavedMapping = { id: number; name: string; mappings_json: string; created_at: string };
type FileData = { columns: string[]; allRows: string[][]; preview: string[][] };

const PHASES = ['Initializing', 'Architecture & Design', 'Setup & Infra', 'Development', 'Testing', 'UAT', 'Deployment', 'Closing'];
const STATUSES = ['To-do', 'In Progress', 'Done', 'Blocked', 'Deferred'];
const DELAY_OWNERS = ['N/A', 'Client', 'Vendor', 'Both', 'External'];
const SKIP = '__skip__';

const FIELD_GROUPS: { label: string; icon: React.ComponentType<{ className?: string }>; keys: string[]; color: string }[] = [
  { label: 'Thông tin cơ bản', icon: Info,          keys: ['no', 'phase', 'activity', 'deliverable', 'sign_off_doc'], color: 'blue'   },
  { label: 'Phân công',        icon: Users,          keys: ['accountable', 'responsible', 'support'],                  color: 'purple' },
  { label: 'Ngày tháng',       icon: Calendar,       keys: ['plan_start', 'plan_end', 'actual_start', 'actual_end'],   color: 'orange' },
  { label: 'Tiến độ',          icon: BarChart2,      keys: ['status', 'completion_pct'],                               color: 'green'  },
  { label: 'Vấn đề trễ',       icon: AlertTriangle,  keys: ['delay_owner', 'delay_reason'],                            color: 'red'    },
  { label: 'Ghi chú',          icon: FileText,       keys: ['notes'],                                                  color: 'gray'   },
];

// ─── Value normalizers ────────────────────────────────────────────────────────

function normalizeDate(raw: string): string {
  if (!raw) return '';
  const v = raw.trim();
  if (!v) return '';

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;

  // DD/MM/YYYY or MM/DD/YYYY or YYYY/MM/DD (separators: / - .)
  const m = v.match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})$/);
  if (m) {
    const [, a, b, c] = m;
    const ai = parseInt(a), bi = parseInt(b), ci = parseInt(c);
    if (a.length === 4) {
      // YYYY/MM/DD
      return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    }
    if (c.length === 4) {
      // DD/MM/YYYY vs MM/DD/YYYY — heuristic: if a > 12 it must be day
      if (ai > 12) return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      if (bi > 12) return `${c}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
      // Default: DD/MM/YYYY (Vietnamese convention)
      return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }
    // Two-digit year (rare) — skip and fall through
    void ai; void ci;
  }

  // Excel serial number (number of days since 1900-01-01)
  const num = Number(v);
  if (!isNaN(num) && num > 1 && num < 2958466) {
    const d = new Date(Math.round((num - 25569) * 86400000));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }

  // Fallback: let Date parse it (handles "Jan 5 2025", ISO with time, etc.)
  const parsed = new Date(v);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];

  return '';
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-\/\.]/g, '');

const STATUS_MAP: Record<string, string> = {
  inprogress: 'In Progress', wip: 'In Progress', ongoing: 'In Progress',
  processing: 'In Progress', running: 'In Progress',
  todo: 'To-do', pending: 'To-do', notstarted: 'To-do', open: 'To-do', new: 'To-do',
  done: 'Done', complete: 'Done', completed: 'Done', finished: 'Done', closed: 'Done',
  blocked: 'Blocked', stuck: 'Blocked', onhold: 'Blocked', hold: 'Blocked',
  deferred: 'Deferred', postponed: 'Deferred', delayed: 'Deferred', cancelled: 'Deferred',
  cancel: 'Deferred', skipped: 'Deferred',
};

const PHASE_MAP: Record<string, string> = {
  init: 'Initializing', initializ: 'Initializing', initiation: 'Initializing',
  arch: 'Architecture & Design', architecture: 'Architecture & Design',
  design: 'Architecture & Design', architecturedesign: 'Architecture & Design',
  setup: 'Setup & Infra', infra: 'Setup & Infra', infrastructure: 'Setup & Infra',
  dev: 'Development', develop: 'Development', development: 'Development', coding: 'Development',
  implement: 'Development', implementation: 'Development',
  test: 'Testing', testing: 'Testing', qa: 'Testing',
  uat: 'UAT', useracceptance: 'UAT', acceptance: 'UAT',
  deploy: 'Deployment', deployment: 'Deployment', release: 'Deployment', golive: 'Deployment',
  clos: 'Closing', closing: 'Closing', close: 'Closing', wrap: 'Closing', handover: 'Closing',
};

const DELAY_MAP: Record<string, string> = {
  na: 'N/A', n: 'N/A', none: 'N/A', notapplicable: 'N/A', no: 'N/A', '': 'N/A',
  client: 'Client', customer: 'Client',
  vendor: 'Vendor', supplier: 'Vendor', partner: 'Vendor',
  both: 'Both', all: 'Both',
  external: 'External', thirdparty: 'External', other: 'External',
};

function fuzzyStatus(raw: string): string {
  if (!raw) return 'To-do';
  const n = norm(raw);
  if (STATUSES.includes(raw)) return raw;
  return STATUS_MAP[n] ?? STATUS_MAP[Object.keys(STATUS_MAP).find(k => n.startsWith(k) || k.startsWith(n)) ?? ''] ?? 'To-do';
}

function fuzzyPhase(raw: string): string {
  if (!raw) return 'Initializing';
  const n = norm(raw);
  if (PHASES.includes(raw)) return raw;
  const found = PHASE_MAP[n] ?? PHASE_MAP[Object.keys(PHASE_MAP).find(k => n.startsWith(k) || k.startsWith(n)) ?? ''];
  return found ?? 'Initializing';
}

function fuzzyDelayOwner(raw: string): string {
  if (!raw) return 'N/A';
  const n = norm(raw);
  if (DELAY_OWNERS.includes(raw)) return raw;
  return DELAY_MAP[n] ?? DELAY_MAP[Object.keys(DELAY_MAP).find(k => n.startsWith(k) || k.startsWith(n)) ?? ''] ?? 'N/A';
}

function resolveField(field: string, raw: string): string {
  switch (field) {
    case 'plan_start': case 'plan_end': case 'actual_start': case 'actual_end':
      return normalizeDate(raw);
    case 'status':      return fuzzyStatus(raw);
    case 'phase':       return fuzzyPhase(raw);
    case 'delay_owner': return fuzzyDelayOwner(raw);
    default: return raw;
  }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ImportMappingDialog({
  open, onOpenChange, projectId, onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  onImported: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [uploading, setUploading] = useState(false);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep(1); setFileData(null); setFileName(''); setMapping({});
    setSaveName(''); setUploading(false); setImporting(false);
  }, []);

  useEffect(() => { if (!open) reset(); }, [open, reset]);

  useEffect(() => {
    if (open) fetch('/api/import-mapping').then(r => r.json()).then(setSavedMappings).catch(() => {});
  }, [open]);

  // ── Step 1: Upload file ────────────────────────────────────────────────────
  const handleFileSelect = async (file: File) => {
    setUploading(true);
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/parse-file-headers', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Parse failed');
      const data: FileData = await res.json();
      if (!data.columns?.length) { toast.error('Không tìm thấy header trong file'); return; }
      setFileData(data);
      const suggested = autoSuggestMapping(data.columns);
      setMapping(suggested);
      setStep(2);
    } catch {
      toast.error('Không thể đọc file. Vui lòng kiểm tra định dạng.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  // ── Step 2: Mapping helpers ────────────────────────────────────────────────
  const setFieldMapping = (field: string, col: string) =>
    setMapping((m: Record<string, string>) => ({ ...m, [field]: col }));

  const applyTemplate = (tpl: SavedMapping) => {
    try {
      const parsed = JSON.parse(tpl.mappings_json) as Record<string, string>;
      // only keep mappings that exist in current file columns
      const filtered: Record<string, string> = {};
      for (const [field, col] of Object.entries(parsed)) {
        if (fileData?.columns.includes(col)) filtered[field] = col;
      }
      setMapping(filtered);
      toast.success(`Đã áp dụng template "${tpl.name}"`);
    } catch { toast.error('Template không hợp lệ'); }
  };

  const saveTemplate = async () => {
    if (!saveName.trim()) { toast.error('Nhập tên template'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/import-mapping', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName.trim(), mappings_json: mapping }),
      });
      const saved = await res.json();
      setSavedMappings((p: SavedMapping[]) => [saved, ...p]);
      setSaveName('');
      toast.success('Đã lưu template mapping');
    } catch { toast.error('Lưu thất bại'); }
    setSaving(false);
  };

  const deleteTemplate = async (id: number) => {
    await fetch(`/api/import-mapping/${id}`, { method: 'DELETE' });
    setSavedMappings((p: SavedMapping[]) => p.filter((m: SavedMapping) => m.id !== id));
    toast.success('Đã xóa template');
  };

  // ── Step 3: Import ─────────────────────────────────────────────────────────
  const mappedPreview = fileData?.preview.map((row: string[]) => {
    const obj: Record<string, string> = {};
    const raw: Record<string, string> = {};
    for (const field of ACTIVITY_FIELDS) {
      const col = mapping[field.key];
      if (col && col !== SKIP) {
        const idx = fileData.columns.indexOf(col);
        const rawVal = idx >= 0 ? (row[idx]?.trim() ?? '') : '';
        raw[field.key] = rawVal;
        obj[field.key] = resolveField(field.key, rawVal);
      }
    }
    return { resolved: obj, raw };
  }) ?? [];

  const handleImport = async () => {
    if (!fileData) return;
    const activityCol = mapping['activity'];
    if (!activityCol || activityCol === SKIP) {
      toast.error('Vui lòng map cột Activity');
      return;
    }
    setImporting(true);
    let count = 0;
    const errors: number[] = [];

    for (let i = 0; i < fileData.allRows.length; i++) {
      const row = fileData.allRows[i];
      const get = (field: string) => {
        const col = mapping[field];
        if (!col || col === SKIP) return '';
        const idx = fileData.columns.indexOf(col);
        return idx >= 0 ? (row[idx]?.trim() ?? '') : '';
      };

      const activity = get('activity');
      if (!activity) continue;

      try {
        await fetch(`/api/projects/${projectId}/activities`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            no: get('no'),
            phase:       fuzzyPhase(get('phase')),
            activity,
            deliverable: get('deliverable'),
            sign_off_doc: get('sign_off_doc'),
            accountable: get('accountable'),
            responsible: get('responsible'),
            support:     get('support'),
            plan_start:  normalizeDate(get('plan_start')),
            plan_end:    normalizeDate(get('plan_end')),
            actual_start: normalizeDate(get('actual_start')),
            actual_end:   normalizeDate(get('actual_end')),
            status:      fuzzyStatus(get('status')),
            completion_pct: Number(get('completion_pct').replace('%', '')) || 0,
            delay_owner: fuzzyDelayOwner(get('delay_owner')),
            delay_reason: get('delay_reason'),
            notes:       get('notes'),
          }),
        });
        count++;
      } catch { errors.push(i + 1); }
    }

    setImporting(false);
    if (errors.length) toast.error(`Import xong, ${errors.length} dòng lỗi`);
    else toast.success(`Đã import ${count} activities`);
    onImported();
    onOpenChange(false);
  };

  const mappedCount = ACTIVITY_FIELDS.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).length;

  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onOpenChange(false); }}>
      <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[94vh] overflow-hidden flex flex-col p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Import Activities
            <span className="ml-auto text-xs font-normal text-slate-400">
              Bước {step} / 3
            </span>
          </DialogTitle>
          {/* Step indicator */}
          <div className="flex items-center gap-1 pt-1">
            {(['Upload file', 'Map cột', 'Xem trước & Import'] as const).map((label, i) => (
              <React.Fragment key={i}>
                <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                  ${step === i + 1 ? 'bg-blue-600 text-white' : step > i + 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                  {step > i + 1 ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                  {label}
                </div>
                {i < 2 && <ChevronRight className="h-3 w-3 text-slate-300" />}
              </React.Fragment>
            ))}
          </div>
        </DialogHeader>

        <div className={`flex-1 py-2 ${step === 2 ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>

          {/* ── Step 1: Upload ─────────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
                onClick={() => fileInputRef.current?.click()}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
              >
                <Upload className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                <p className="font-medium text-slate-600">Kéo thả hoặc click để chọn file</p>
                <p className="text-xs text-slate-400 mt-1">Hỗ trợ: .xlsx, .xls, .csv, .txt</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.txt"
                className="hidden"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
              />
              {uploading && (
                <div className="text-center text-sm text-blue-600 animate-pulse">
                  Đang đọc file...
                </div>
              )}
              <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
                <p className="font-medium text-slate-600">Lưu ý:</p>
                <p>• Hệ thống tự động tìm dòng header — bỏ qua các dòng trống ở đầu file</p>
                <p>• Hỗ trợ mọi cấu trúc file: tên cột bất kỳ, thứ tự tuỳ ý</p>
                <p>• Bước tiếp theo bạn chỉ cần kéo thả / chọn dropdown để map từng cột</p>
              </div>
            </div>
          )}

          {/* ── Step 2: Mapping ────────────────────────────────────────────────── */}
          {step === 2 && fileData && (
            <div className="flex flex-col gap-3 h-full">

              {/* Top bar: file info + templates + save */}
              <div className="flex flex-wrap items-center gap-2">
                {/* File badge */}
                <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs shrink-0">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-medium text-blue-700 max-w-[200px] truncate">{fileName}</span>
                  <span className="text-blue-400">·</span>
                  <span className="text-blue-600">{fileData.columns.length} cột</span>
                  <span className="text-blue-400">·</span>
                  <span className="text-blue-600">{fileData.allRows.length} dòng</span>
                </div>

                {/* Mapped count badge */}
                <div className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs shrink-0 border
                  ${mappedCount > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  <Check className="h-3.5 w-3.5" />
                  {mappedCount}/{ACTIVITY_FIELDS.length} trường đã map
                </div>

                <button
                  className="text-xs text-blue-500 hover:text-blue-700 hover:underline px-2 py-1 shrink-0"
                  onClick={() => setMapping(autoSuggestMapping(fileData.columns))}
                >
                  Gợi ý tự động
                </button>

                <div className="flex-1" />

                {/* Saved templates */}
                {savedMappings.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 shrink-0">Template:</span>
                    {savedMappings.map(tpl => (
                      <div key={tpl.id} className="flex items-center bg-white border border-slate-200 rounded-md overflow-hidden text-xs">
                        <button
                          className="px-2 py-1 text-blue-600 hover:bg-blue-50 font-medium"
                          onClick={() => applyTemplate(tpl)}
                          title="Áp dụng template này"
                        >
                          {tpl.name}
                        </button>
                        <button
                          onClick={() => deleteTemplate(tpl.id)}
                          className="px-1.5 py-1 text-slate-300 hover:text-red-500 hover:bg-red-50 border-l border-slate-200"
                          title="Xóa template"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Save template inline */}
                <div className="flex items-center gap-1 shrink-0">
                  <Input
                    className="h-7 text-xs w-40"
                    placeholder="Tên template..."
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTemplate(); }}
                  />
                  <Button size="sm" variant="outline" onClick={saveTemplate} disabled={saving || !saveName.trim()} className="gap-1 h-7 text-xs px-2">
                    <Save className="h-3 w-3" />
                    {saving ? '...' : 'Lưu'}
                  </Button>
                </div>
              </div>

              {/* Two-panel mapping area */}
              <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">

                {/* LEFT PANEL: File columns */}
                <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold shrink-0">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Cột trong file Excel</span>
                    <span className="ml-auto text-blue-200 text-xs font-normal">{fileData.columns.length} cột</span>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 bg-white">
                    {fileData.columns.map((col, idx) => {
                      const mappedField = Object.entries(mapping).find(([, v]) => v === col);
                      const fieldDef = mappedField ? ACTIVITY_FIELDS.find(f => f.key === mappedField[0]) : null;
                      const sampleVal = fileData.preview.find(r => r[idx]?.trim())?.[idx] ?? '';
                      return (
                        <div key={col} className={`flex items-start gap-3 px-3 py-2.5 transition-colors
                          ${fieldDef ? 'bg-green-50 hover:bg-green-100/70' : 'hover:bg-slate-50'}`}>
                          <span className="text-[11px] text-slate-400 w-5 text-right mt-0.5 shrink-0 font-mono">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate ${fieldDef ? 'text-slate-800' : 'text-slate-600'}`}>
                              {col}
                            </p>
                            {sampleVal && (
                              <p className="text-[11px] text-slate-400 truncate mt-0.5 italic">{sampleVal}</p>
                            )}
                          </div>
                          {fieldDef ? (
                            <span className="shrink-0 text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                              → {fieldDef.label}
                            </span>
                          ) : (
                            <span className="shrink-0 text-[10px] text-slate-300 px-1.5 py-0.5">—</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* RIGHT PANEL: Timeline mapping — grouped */}
                <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white text-sm font-semibold shrink-0">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <span>Trường trong Timeline</span>
                    <span className="ml-auto text-slate-400 text-xs font-normal">{mappedCount}/{ACTIVITY_FIELDS.length} đã map</span>
                  </div>
                  <div className="overflow-y-auto flex-1 bg-white">
                    {FIELD_GROUPS.map(group => {
                      const groupFields = ACTIVITY_FIELDS.filter(f => group.keys.includes(f.key));
                      const mappedInGroup = groupFields.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).length;
                      const GroupIcon = group.icon;

                      const headerColor: Record<string, string> = {
                        blue:   'text-blue-700 bg-blue-50 border-blue-100',
                        purple: 'text-purple-700 bg-purple-50 border-purple-100',
                        orange: 'text-orange-700 bg-orange-50 border-orange-100',
                        green:  'text-green-700 bg-green-50 border-green-100',
                        red:    'text-red-700 bg-red-50 border-red-100',
                        gray:   'text-slate-500 bg-slate-50 border-slate-100',
                      };
                      const dotDefault: Record<string, string> = {
                        blue: 'bg-blue-300', purple: 'bg-purple-300', orange: 'bg-orange-300',
                        green: 'bg-green-300', red: 'bg-red-300', gray: 'bg-slate-200',
                      };

                      return (
                        <div key={group.label}>
                          {/* Group header */}
                          <div className={`sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-t ${headerColor[group.color]}`}>
                            <GroupIcon className="h-3 w-3 shrink-0" />
                            <span className="text-[11px] font-semibold uppercase tracking-wide flex-1">{group.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                              ${mappedInGroup === groupFields.length
                                ? 'bg-green-500 text-white'
                                : mappedInGroup > 0 ? 'bg-white/80 text-current' : 'bg-white/60 text-current opacity-60'}`}>
                              {mappedInGroup}/{groupFields.length}
                            </span>
                          </div>

                          {/* Fields in group */}
                          {groupFields.map(field => {
                            const isMapped = !!(mapping[field.key] && mapping[field.key] !== SKIP);
                            const isRequiredUnmapped = field.required && !isMapped;
                            const mappedCol = isMapped ? mapping[field.key] : null;
                            const colIdx = mappedCol != null ? fileData.columns.indexOf(mappedCol) : -1;
                            const sampleRaw = colIdx >= 0
                              ? (fileData.preview.find((r: string[]) => r[colIdx]?.trim())?.[colIdx] ?? '')
                              : '';
                            const sampleResolved = sampleRaw ? resolveField(field.key, sampleRaw) : '';
                            const wasConverted = !!(sampleRaw && sampleResolved && sampleRaw !== sampleResolved);

                            return (
                              <div key={field.key} className={`px-3 py-2 border-b last:border-b-0 transition-colors
                                ${isMapped ? 'bg-green-50/40' : isRequiredUnmapped ? 'bg-red-50/30' : 'hover:bg-slate-50/60'}`}>

                                {/* Label row */}
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0
                                    ${isMapped ? 'bg-green-500' : isRequiredUnmapped ? 'bg-red-400' : dotDefault[group.color]}`} />
                                  <span className={`text-[11px] leading-tight flex-1
                                    ${field.required ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                                    {field.label}
                                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                  </span>
                                  {isMapped && <Check className="h-3 w-3 text-green-500 shrink-0" />}
                                </div>

                                {/* Dropdown */}
                                <Select
                                  value={mapping[field.key] ?? SKIP}
                                  onValueChange={(val: string) => setFieldMapping(field.key, val ?? SKIP)}
                                >
                                  <SelectTrigger className={`h-7 text-xs w-full
                                    ${isMapped
                                      ? 'border-green-300 bg-white text-green-800 font-medium'
                                      : isRequiredUnmapped ? 'border-red-200 text-slate-400' : 'text-slate-400'}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={SKIP}>— Bỏ qua —</SelectItem>
                                    {fileData.columns.map((col: string) => {
                                      const ci = fileData.columns.indexOf(col);
                                      const s = fileData.preview.find((r: string[]) => r[ci]?.trim())?.[ci] ?? '';
                                      return (
                                        <SelectItem key={col} value={col}>
                                          {col}{s ? ` · ${s.length > 20 ? s.substring(0, 20) + '…' : s}` : ''}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>

                                {/* Sample value preview */}
                                {isMapped && (
                                  <div className="mt-1 px-1">
                                    {sampleRaw ? (
                                      wasConverted ? (
                                        <div className="flex items-center gap-1 text-[10px] text-amber-600">
                                          <span className="line-through opacity-60 truncate max-w-[40%]">{sampleRaw}</span>
                                          <span className="shrink-0">→</span>
                                          <span className="font-medium truncate">{sampleResolved}</span>
                                        </div>
                                      ) : (
                                        <div className="text-[10px] text-slate-400 italic truncate">{sampleResolved || sampleRaw}</div>
                                      )
                                    ) : (
                                      <div className="text-[10px] text-slate-300 italic">không có dữ liệu mẫu</div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ────────────────────────────────────────────────── */}
          {step === 3 && fileData && (
            <div className="space-y-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-xs text-slate-500 bg-slate-50 rounded px-3 py-2">
                  Xem trước {Math.min(mappedPreview.length, 8)} dòng đầu · tổng <strong>{fileData.allRows.length}</strong> dòng
                </div>
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-300 shrink-0" />
                  Giá trị được tự động chuẩn hoá (ngày, status…)
                </div>
              </div>

              <div className="border rounded-lg overflow-auto max-h-[60vh]">
                <table className="text-[11px] w-full">
                  <thead className="bg-slate-50 border-b sticky top-0">
                    <tr>
                      {ACTIVITY_FIELDS.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).map(f => (
                        <th key={f.key} className="px-2 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-r last:border-r-0">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mappedPreview.slice(0, 8).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {ACTIVITY_FIELDS.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).map(f => {
                          const resolved = row.resolved[f.key] ?? '';
                          const rawVal   = row.raw[f.key] ?? '';
                          const wasConverted = rawVal && resolved && rawVal !== resolved;
                          return (
                            <td key={f.key} className={`px-2 py-1.5 max-w-[150px] border-r last:border-r-0
                              ${wasConverted ? 'bg-amber-50' : ''}`}>
                              <div className="truncate font-medium text-slate-800">{resolved || '—'}</div>
                              {wasConverted && (
                                <div className="truncate text-[10px] text-amber-600 mt-0.5" title={`Gốc: ${rawVal}`}>
                                  ← {rawVal}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {!mapping['activity'] || mapping['activity'] === SKIP ? (
                <div className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
                  Chưa map cột Activity (bắt buộc). Quay lại bước 2 để mapping.
                </div>
              ) : (
                <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded px-3 py-2">
                  ✓ Sẵn sàng import <strong>{fileData.allRows.filter(r => {
                    const idx = fileData.columns.indexOf(mapping['activity']);
                    return idx >= 0 && r[idx]?.trim();
                  }).length}</strong> activities · Các dòng không có Activity sẽ bị bỏ qua
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => { if (step === 1) onOpenChange(false); else setStep(s => (s - 1) as 1 | 2 | 3); }}>
            {step === 1 ? 'Hủy' : <><ChevronLeft className="h-4 w-4 mr-1" />Quay lại</>}
          </Button>
          <div className="flex-1" />
          {step < 3 && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={step === 1 ? !fileData : false}
              onClick={() => setStep(s => (s + 1) as 2 | 3)}
            >
              Tiếp theo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={importing || !mapping['activity'] || mapping['activity'] === SKIP}
              onClick={handleImport}
            >
              {importing ? 'Đang import...' : `Import ${fileData?.allRows.length ?? 0} dòng`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
