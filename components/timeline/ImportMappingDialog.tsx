'use client';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, Save, Trash2, ChevronRight, ChevronLeft, FileSpreadsheet, Check } from 'lucide-react';

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
    setMapping(m => ({ ...m, [field]: col }));

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
      setSavedMappings(p => [saved, ...p]);
      setSaveName('');
      toast.success('Đã lưu template mapping');
    } catch { toast.error('Lưu thất bại'); }
    setSaving(false);
  };

  const deleteTemplate = async (id: number) => {
    await fetch(`/api/import-mapping/${id}`, { method: 'DELETE' });
    setSavedMappings(p => p.filter(m => m.id !== id));
    toast.success('Đã xóa template');
  };

  // ── Step 3: Import ─────────────────────────────────────────────────────────
  const mappedPreview = fileData?.preview.map(row => {
    const obj: Record<string, string> = {};
    for (const field of ACTIVITY_FIELDS) {
      const col = mapping[field.key];
      if (col && col !== SKIP) {
        const idx = fileData.columns.indexOf(col);
        obj[field.key] = idx >= 0 ? (row[idx] ?? '') : '';
      }
    }
    return obj;
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

      const phase = get('phase');
      const status = get('status');
      const delayOwner = get('delay_owner');

      try {
        await fetch(`/api/projects/${projectId}/activities`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            no: get('no'),
            phase: PHASES.includes(phase) ? phase : 'Initializing',
            activity,
            deliverable: get('deliverable'),
            sign_off_doc: get('sign_off_doc'),
            accountable: get('accountable'),
            responsible: get('responsible'),
            support: get('support'),
            plan_start: get('plan_start'),
            plan_end: get('plan_end'),
            actual_start: get('actual_start'),
            actual_end: get('actual_end'),
            status: STATUSES.includes(status) ? status : 'To-do',
            completion_pct: Number(get('completion_pct')) || 0,
            delay_owner: DELAY_OWNERS.includes(delayOwner) ? delayOwner : 'N/A',
            delay_reason: get('delay_reason'),
            notes: get('notes'),
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
    <Dialog open={open} onOpenChange={o => { if (!o) onOpenChange(false); }}>
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

                {/* RIGHT PANEL: Timeline mapping */}
                <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white text-sm font-semibold shrink-0">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <span>Trường trong Timeline</span>
                    <span className="ml-auto text-slate-400 text-xs font-normal">{ACTIVITY_FIELDS.length} trường</span>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 bg-white">
                    {ACTIVITY_FIELDS.map(field => {
                      const isMapped = mapping[field.key] && mapping[field.key] !== SKIP;
                      const isRequiredUnmapped = field.required && !isMapped;
                      return (
                        <div key={field.key} className={`flex items-center gap-3 px-3 py-2 transition-colors
                          ${isMapped ? 'bg-green-50/60' : isRequiredUnmapped ? 'bg-red-50/40' : ''}`}>
                          {/* Status dot */}
                          <div className={`w-2 h-2 rounded-full shrink-0
                            ${isMapped ? 'bg-green-500' : isRequiredUnmapped ? 'bg-red-400' : 'bg-slate-200'}`} />

                          {/* Field label */}
                          <div className="w-36 shrink-0">
                            <span className={`text-xs ${field.required ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                              {field.label}
                              {field.required && <span className="text-red-500 ml-0.5">*</span>}
                            </span>
                          </div>

                          {/* Arrow */}
                          <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${isMapped ? 'text-green-500' : 'text-slate-200'}`} />

                          {/* Dropdown */}
                          <div className="flex-1 min-w-0">
                            <Select
                              value={mapping[field.key] ?? SKIP}
                              onValueChange={val => setFieldMapping(field.key, val ?? SKIP)}
                            >
                              <SelectTrigger className={`h-7 text-xs w-full
                                ${isMapped ? 'border-green-300 bg-white text-green-700 font-medium' : 'text-slate-400'}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value={SKIP}>— Bỏ qua —</SelectItem>
                                {fileData.columns.map(col => (
                                  <SelectItem key={col} value={col}>{col}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Check icon */}
                          {isMapped && <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />}
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
              <div className="text-xs text-slate-500 bg-slate-50 rounded px-3 py-2">
                Xem trước {Math.min(mappedPreview.length, 6)} dòng đầu (tổng {fileData.allRows.length} dòng sẽ được import)
              </div>
              <div className="border rounded-lg overflow-auto max-h-[55vh]">
                <table className="text-[10px] w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      {ACTIVITY_FIELDS.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).map(f => (
                        <th key={f.key} className="px-2 py-1.5 text-left font-semibold text-slate-500 whitespace-nowrap">{f.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {mappedPreview.slice(0, 6).map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {ACTIVITY_FIELDS.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).map(f => (
                          <td key={f.key} className="px-2 py-1 max-w-[120px] truncate text-slate-700">{row[f.key] || '—'}</td>
                        ))}
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
                <div className="text-xs text-green-700 bg-green-50 rounded px-3 py-2">
                  Sẵn sàng import {fileData.allRows.filter(r => {
                    const idx = fileData.columns.indexOf(mapping['activity']);
                    return idx >= 0 && r[idx]?.trim();
                  }).length} activities (bỏ qua các dòng không có Activity)
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
