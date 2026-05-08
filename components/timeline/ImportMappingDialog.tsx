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
      <DialogContent className="w-[95vw] max-w-5xl h-[92vh] overflow-hidden flex flex-col">
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

        <div className="flex-1 overflow-y-auto py-2">

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
                <p>• Dòng đầu tiên của file sẽ được nhận diện làm header (tên cột)</p>
                <p>• Hệ thống sẽ tự động gợi ý mapping dựa trên tên cột</p>
                <p>• Bạn có thể điều chỉnh mapping thủ công ở bước tiếp theo</p>
              </div>
            </div>
          )}

          {/* ── Step 2: Mapping ────────────────────────────────────────────────── */}
          {step === 2 && fileData && (
            <div className="space-y-4">
              {/* Saved templates */}
              {savedMappings.length > 0 && (
                <div className="bg-blue-50 rounded-lg p-3">
                  <p className="text-xs font-semibold text-blue-700 mb-2">Template đã lưu</p>
                  <div className="flex flex-wrap gap-1.5">
                    {savedMappings.map(tpl => (
                      <div key={tpl.id} className="flex items-center gap-1 bg-white border border-blue-200 rounded-md px-2 py-1 text-xs">
                        <button
                          className="text-blue-600 hover:underline font-medium"
                          onClick={() => applyTemplate(tpl)}
                        >
                          {tpl.name}
                        </button>
                        <button onClick={() => deleteTemplate(tpl.id)} className="text-slate-300 hover:text-red-500 ml-1">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* File info */}
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded px-3 py-2">
                <FileSpreadsheet className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="font-medium truncate">{fileName}</span>
                <span className="shrink-0">— {fileData.columns.length} cột, {fileData.allRows.length} dòng dữ liệu</span>
              </div>

              {/* Mapping table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-slate-600">
                    Mapping cột ({mappedCount}/{ACTIVITY_FIELDS.length} đã map)
                  </p>
                  <button
                    className="text-xs text-blue-500 hover:underline"
                    onClick={() => setMapping(autoSuggestMapping(fileData.columns))}
                  >
                    Tự động gợi ý lại
                  </button>
                </div>
                <div className="border rounded-lg overflow-hidden text-xs">
                  <div className="grid grid-cols-2 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-500 border-b">
                    <span>Trường trong Timeline</span>
                    <span>Cột trong file</span>
                  </div>
                  <div className="divide-y max-h-[45vh] overflow-y-auto">
                    {ACTIVITY_FIELDS.map(field => (
                      <div key={field.key} className="grid grid-cols-2 items-center px-3 py-1.5 hover:bg-slate-50">
                        <span className={`text-xs ${field.required ? 'font-semibold text-slate-700' : 'text-slate-500'}`}>
                          {field.label}{field.required && <span className="text-red-500 ml-0.5">*</span>}
                        </span>
                        <Select
                          value={mapping[field.key] ?? SKIP}
                          onValueChange={val => setFieldMapping(field.key, val ?? SKIP)}
                        >
                          <SelectTrigger className="h-7 text-xs">
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
                    ))}
                  </div>
                </div>
              </div>

              {/* Save template */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-slate-600 mb-2">Lưu mapping này để dùng lại</p>
                <div className="flex gap-2">
                  <Input
                    className="h-8 text-xs flex-1"
                    placeholder="Tên template (vd: JIRA Export, Trello...)"
                    value={saveName}
                    onChange={e => setSaveName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveTemplate(); }}
                  />
                  <Button size="sm" variant="outline" onClick={saveTemplate} disabled={saving || !saveName.trim()} className="gap-1 h-8">
                    <Save className="h-3.5 w-3.5" />
                    {saving ? 'Đang lưu...' : 'Lưu'}
                  </Button>
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
