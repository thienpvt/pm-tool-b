'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Upload, Save, Trash2, ChevronRight, ChevronLeft, FileSpreadsheet, Check,
  ClipboardPaste, Bug, Users, Tag, Calendar, Info,
} from 'lucide-react';

// ─── Bug fields ────────────────────────────────────────────────────────────────
const BUG_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'issue_type', label: 'Issue Type' },
  { key: 'issue_key',  label: 'Issue Key' },
  { key: 'issue_id',   label: 'Issue ID' },
  { key: 'summary',    label: 'Summary', required: true },
  { key: 'assignee',   label: 'Assignee' },
  { key: 'reporter',   label: 'Reporter' },
  { key: 'priority',   label: 'Priority' },
  { key: 'status',     label: 'Status' },
  { key: 'resolution', label: 'Resolution' },
  { key: 'created',    label: 'Created Date' },
];

const FIELD_GROUPS: { label: string; icon: React.ComponentType<{ className?: string }>; keys: string[]; color: string }[] = [
  { label: 'Thông tin cơ bản', icon: Info,     keys: ['issue_type', 'issue_key', 'issue_id', 'summary'], color: 'blue'   },
  { label: 'Phân công',        icon: Users,    keys: ['assignee', 'reporter'],                            color: 'purple' },
  { label: 'Phân loại',        icon: Tag,      keys: ['priority', 'status', 'resolution'],                color: 'green'  },
  { label: 'Thời gian',        icon: Calendar, keys: ['created'],                                         color: 'orange' },
];

const FIELD_ALIASES: Record<string, string[]> = {
  issue_type: ['issue type', 'issuetype', 'type', 'bug type', 'loai'],
  issue_key:  ['issue key', 'key', 'jira key', 'ticket', 'ma'],
  issue_id:   ['issue id', 'id', 'bug id', 'ticket id', 'so'],
  summary:    ['summary', 'title', 'description', 'subject', 'name', 'bug name', 'mo ta', 'tieu de'],
  assignee:   ['assignee', 'assigned to', 'owner', 'developer', 'nguoi xu ly', 'phu trach'],
  reporter:   ['reporter', 'reported by', 'created by', 'nguoi bao', 'nguoi tao'],
  priority:   ['priority', 'severity', 'urgency', 'do uu tien', 'muc do'],
  status:     ['status', 'state', 'bug status', 'trang thai'],
  resolution: ['resolution', 'resolved', 'fix status', 'ket qua'],
  created:    ['created', 'created date', 'create date', 'date created', 'creation date', 'ngay tao'],
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

// ─── Normalizers ──────────────────────────────────────────────────────────────
function normalizeDate(raw: string): string {
  if (!raw) return '';
  const v = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})$/);
  if (m) {
    const [, a, b, c] = m;
    if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    if (c.length === 4) return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
  }
  const num = Number(v);
  if (!isNaN(num) && num > 1 && num < 2958466) {
    const d = new Date(Math.round((num - 25569) * 86400000));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const parsed = new Date(v);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return v;
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-\/\.]/g, '');

const PRIORITY_MAP: Record<string, string> = {
  critical: 'Critical', blocker: 'Critical', highest: 'Critical', p1: 'Critical',
  major: 'Major', high: 'Major', p2: 'Major',
  medium: 'Medium', normal: 'Medium', moderate: 'Medium', p3: 'Medium',
  minor: 'Minor', low: 'Minor', p4: 'Minor', lowest: 'Minor', trivial: 'Minor',
};
const PRIORITIES = ['Critical', 'Major', 'Medium', 'Minor'];

const BUG_STATUS_MAP: Record<string, string> = {
  todo: 'To Do', 'to do': 'To Do', open: 'To Do', new: 'To Do', backlog: 'To Do',
  inprogress: 'In Progress', 'in progress': 'In Progress', doing: 'In Progress', ongoing: 'In Progress', processing: 'In Progress',
  reopen: 'Reopen', 'reopen': 'Reopen', reopened: 'Reopen', 're-open': 'Reopen',
  readyfortest: 'Ready for Test', 'ready for test': 'Ready for Test', readytest: 'Ready for Test', r4t: 'Ready for Test',
  done: 'Done', closed: 'Done', fixed: 'Done', complete: 'Done', completed: 'Done',
  resolved: 'Resolved', resolve: 'Resolved',
  blocked: 'Blocked', hold: 'Blocked', onhold: 'Blocked',
  wontfix: 'Won\'t Fix', wontdo: 'Won\'t Fix',
  duplicate: 'Duplicate',
};
const BUG_STATUSES = ['To Do', 'In Progress', 'Reopen', 'Ready for Test', 'Done', 'Resolved', 'Blocked', "Won't Fix", 'Duplicate'];

function fuzzyPriority(raw: string): string {
  if (!raw) return 'Medium';
  if (PRIORITIES.includes(raw)) return raw;
  return PRIORITY_MAP[norm(raw)] ?? PRIORITY_MAP[Object.keys(PRIORITY_MAP).find(k => norm(raw).includes(k)) ?? ''] ?? 'Medium';
}

function fuzzyStatus(raw: string): string {
  if (!raw) return 'To Do';
  if (BUG_STATUSES.includes(raw)) return raw;
  const n = norm(raw);
  return BUG_STATUS_MAP[n] ?? BUG_STATUS_MAP[Object.keys(BUG_STATUS_MAP).find(k => n.includes(k) || k.includes(n)) ?? ''] ?? 'To Do';
}

function resolveField(field: string, raw: string): string {
  if (!raw) return '';
  switch (field) {
    case 'created': return normalizeDate(raw);
    case 'priority': return fuzzyPriority(raw);
    case 'status': return fuzzyStatus(raw);
    default: return raw;
  }
}

// ─── CSV Parser ────────────────────────────────────────────────────────────────
type FileData = { columns: string[]; allRows: string[][]; preview: string[][] };

function parseCSVText(text: string): FileData {
  const rows: string[][] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  for (const line of lines) {
    if (!line.trim()) continue;
    const cells: string[] = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cells.push(cur.trim()); cur = '';
      } else { cur += ch; }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  if (rows.length < 1) return { columns: [], allRows: [], preview: [] };
  const columns = rows[0];
  const dataRows = rows.slice(1).filter(r => r.some(c => c));
  return { columns, allRows: dataRows, preview: dataRows.slice(0, 10) };
}

// ─── Types ────────────────────────────────────────────────────────────────────
type SavedMapping = { id: number; name: string; mappings_json: string; created_at: string };
const SKIP = '__skip__';

// ─── Main component ───────────────────────────────────────────────────────────
export default function BugImportDialog({
  open, onOpenChange, projectId, onImported,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  onImported: () => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [importSource, setImportSource] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
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
    setPastedText(''); setImportSource('file');
  }, []);

  useEffect(() => { if (!open) reset(); }, [open, reset]);

  useEffect(() => {
    if (open) {
      fetch('/api/bug-import-mapping').then(r => r.json()).then(setSavedMappings).catch(() => {});
    }
  }, [open]);

  const textPreview = useMemo(() => {
    if (!pastedText.trim()) return null;
    return parseCSVText(pastedText);
  }, [pastedText]);

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
      setMapping(autoSuggestMapping(data.columns));
      setStep(2);
    } catch { toast.error('Không thể đọc file. Vui lòng kiểm tra định dạng.'); }
    finally { setUploading(false); }
  };

  const handleParseText = () => {
    if (!pastedText.trim()) { toast.error('Chưa có nội dung để phân tích'); return; }
    const data = parseCSVText(pastedText);
    if (!data.columns.length) { toast.error('Không tìm thấy cột nào trong nội dung'); return; }
    setFileName('(paste từ clipboard)');
    setFileData(data);
    setMapping(autoSuggestMapping(data.columns));
    setStep(2);
  };

  const setFieldMapping = (field: string, col: string) =>
    setMapping((m: Record<string, string>) => ({ ...m, [field]: col }));

  const applyTemplate = (tpl: SavedMapping) => {
    try {
      const parsed = JSON.parse(tpl.mappings_json) as Record<string, string>;
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
    if (savedMappings.length >= 5) {
      toast.error('Tối đa 5 template. Xóa template cũ trước khi lưu mới.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/bug-import-mapping', {
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
    await fetch(`/api/bug-import-mapping/${id}`, { method: 'DELETE' });
    setSavedMappings(p => p.filter(m => m.id !== id));
    toast.success('Đã xóa template');
  };

  const previewRows = useMemo(() => {
    if (!fileData) return [];
    return fileData.allRows.slice(0, 8).map(row => {
      const obj: Record<string, string> = {};
      const raw: Record<string, string> = {};
      for (const f of BUG_FIELDS) {
        const col = mapping[f.key];
        if (col && col !== SKIP) {
          const idx = fileData.columns.indexOf(col);
          const rawVal = idx >= 0 ? (row[idx]?.trim() ?? '') : '';
          raw[f.key] = rawVal;
          obj[f.key] = resolveField(f.key, rawVal);
        }
      }
      return { resolved: obj, raw };
    });
  }, [fileData, mapping]);

  const handleImport = async () => {
    if (!fileData) return;
    const summaryCol = mapping['summary'];
    if (!summaryCol || summaryCol === SKIP) {
      toast.error('Vui lòng map cột Summary');
      return;
    }
    setImporting(true);
    const summaryIdx = fileData.columns.indexOf(summaryCol);

    const get = (row: string[], field: string): string => {
      const col = mapping[field];
      if (!col || col === SKIP) return '';
      const idx = fileData.columns.indexOf(col);
      return idx >= 0 ? (row[idx]?.trim() ?? '') : '';
    };

    const bugs = fileData.allRows
      .filter(row => row[summaryIdx]?.trim())
      .map(row => ({
        issue_type: get(row, 'issue_type'),
        issue_key:  get(row, 'issue_key'),
        issue_id:   get(row, 'issue_id'),
        summary:    get(row, 'summary'),
        assignee:   get(row, 'assignee'),
        reporter:   get(row, 'reporter'),
        priority:   resolveField('priority', get(row, 'priority')) || 'Medium',
        status:     resolveField('status', get(row, 'status')) || 'To Do',
        resolution: get(row, 'resolution'),
        created:    resolveField('created', get(row, 'created')),
      }));

    try {
      const res = await fetch(`/api/projects/${projectId}/bugs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bugs, replace: true }),
      });
      const result = await res.json();
      toast.success(`Import thành công: ${result.inserted} bug`);
      onImported();
      onOpenChange(false);
    } catch { toast.error('Import thất bại'); }
    setImporting(false);
  };

  const mappedCount = BUG_FIELDS.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).length;

  const headerColors: Record<string, string> = {
    blue:   'text-blue-700 bg-blue-50 border-blue-100',
    purple: 'text-purple-700 bg-purple-50 border-purple-100',
    green:  'text-green-700 bg-green-50 border-green-100',
    orange: 'text-orange-700 bg-orange-50 border-orange-100',
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onOpenChange(false); }}>
      <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[94vh] overflow-hidden flex flex-col p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="h-5 w-5 text-red-500" />
            Import Bugs
            <span className="ml-auto text-xs font-normal text-slate-400">Bước {step} / 3</span>
          </DialogTitle>
          <div className="flex items-center gap-1 pt-1">
            {(['Upload / Paste', 'Map cột', 'Xem trước & Import'] as const).map((label, i) => (
              <React.Fragment key={i}>
                <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                  ${step === i + 1 ? 'bg-red-500 text-white' : step > i + 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                  {step > i + 1 ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                  {label}
                </div>
                {i < 2 && <ChevronRight className="h-3 w-3 text-slate-300" />}
              </React.Fragment>
            ))}
          </div>
        </DialogHeader>

        <div className={`flex-1 py-2 ${step === 2 ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>

          {/* ── Step 1 ────────────────────────────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-4 h-full">
              <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 w-fit">
                {(['file', 'text'] as const).map(src => (
                  <button key={src} onClick={() => setImportSource(src)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                      importSource === src ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}>
                    {src === 'file' ? <><Upload className="h-3.5 w-3.5" /> Upload file</> : <><ClipboardPaste className="h-3.5 w-3.5" /> Paste text</>}
                  </button>
                ))}
              </div>

              {importSource === 'file' && (
                <div className="space-y-4">
                  <div
                    className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-red-400 hover:bg-red-50/40 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFileSelect(f); }}
                    onDragOver={e => e.preventDefault()}
                  >
                    <Bug className="h-10 w-10 mx-auto text-slate-300 mb-3" />
                    <p className="font-medium text-slate-600">Kéo thả hoặc click để chọn file</p>
                    <p className="text-xs text-slate-400 mt-1">Hỗ trợ: .xlsx, .xls, .csv, .txt — Jira CSV export</p>
                  </div>
                  <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }} />
                  {uploading && <div className="text-center text-sm text-red-500 animate-pulse">Đang đọc file...</div>}
                  <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
                    <p className="font-medium text-slate-600">Lưu ý:</p>
                    <p>• Import sẽ <strong>xóa toàn bộ bug cũ</strong> và thay thế bằng dữ liệu mới</p>
                    <p>• Hỗ trợ export từ Jira: Issue Type, Key, ID, Summary, Assignee, Reporter, Priority, Status, Resolution, Created</p>
                  </div>
                </div>
              )}

              {importSource === 'text' && (
                <div className="flex flex-col gap-3 flex-1 min-h-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Paste nội dung CSV từ Jira vào ô bên dưới</span>
                    {textPreview && textPreview.columns.length > 0 && (
                      <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full ml-auto">
                        ✓ {textPreview.columns.length} cột · {textPreview.allRows.length} dòng
                      </span>
                    )}
                  </div>
                  <textarea
                    className="flex-1 font-mono text-xs border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none bg-slate-50"
                    placeholder={`Issue Type,Issue key,Issue id,Summary,Assignee,Reporter,Priority,Status,Resolution,Created\nBug,PROJ-1,10001,Login page crash,Nguyen A,Tran B,Critical,In Progress,,2026-01-15`}
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                  />
                  {textPreview && textPreview.columns.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-auto max-h-36 bg-white">
                      <table className="text-[10px] w-full">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            {textPreview.columns.slice(0, 8).map((col, i) => (
                              <th key={i} className="px-2 py-1.5 text-left font-semibold text-slate-600 border-r last:border-r-0 whitespace-nowrap">{col}</th>
                            ))}
                            {textPreview.columns.length > 8 && <th className="px-2 py-1.5 text-slate-400">+{textPreview.columns.length - 8}</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {textPreview.preview.slice(0, 3).map((row, ri) => (
                            <tr key={ri}>
                              {textPreview.columns.slice(0, 8).map((_, ci) => (
                                <td key={ci} className="px-2 py-1 border-r last:border-r-0 max-w-[120px] truncate text-slate-600">{row[ci] ?? ''}</td>
                              ))}
                              {textPreview.columns.length > 8 && <td className="px-2 py-1 text-slate-300">…</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Mapping ────────────────────────────────────────────────── */}
          {step === 2 && fileData && (
            <div className="flex flex-col gap-3 h-full">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 text-xs shrink-0">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-red-500" />
                  <span className="font-medium text-red-700 max-w-[200px] truncate">{fileName}</span>
                  <span className="text-red-400">·</span>
                  <span className="text-red-600">{fileData.columns.length} cột · {fileData.allRows.length} dòng</span>
                </div>
                <div className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs shrink-0 border
                  ${mappedCount > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  <Check className="h-3.5 w-3.5" />
                  {mappedCount}/{BUG_FIELDS.length} trường đã map
                </div>
                <button className="text-xs text-red-500 hover:text-red-700 hover:underline px-2 py-1 shrink-0"
                  onClick={() => setMapping(autoSuggestMapping(fileData.columns))}>
                  Gợi ý tự động
                </button>
                <div className="flex-1" />

                {savedMappings.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 shrink-0">Template ({savedMappings.length}/5):</span>
                    {savedMappings.map(tpl => (
                      <div key={tpl.id} className="flex items-center bg-white border border-slate-200 rounded-md overflow-hidden text-xs">
                        <button className="px-2 py-1 text-red-600 hover:bg-red-50 font-medium" onClick={() => applyTemplate(tpl)}>{tpl.name}</button>
                        <button onClick={() => deleteTemplate(tpl.id)} className="px-1.5 py-1 text-slate-300 hover:text-red-500 hover:bg-red-50 border-l border-slate-200"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}

                {savedMappings.length < 5 && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Input className="h-7 text-xs w-36" placeholder="Tên template..." value={saveName}
                      onChange={e => setSaveName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTemplate(); }} />
                    <Button size="sm" variant="outline" onClick={saveTemplate} disabled={saving || !saveName.trim()} className="gap-1 h-7 text-xs px-2">
                      <Save className="h-3 w-3" />{saving ? '...' : 'Lưu'}
                    </Button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
                {/* LEFT: File columns */}
                <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500 text-white text-sm font-semibold shrink-0">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Cột trong file / text</span>
                    <span className="ml-auto text-red-100 text-xs font-normal">{fileData.columns.length} cột</span>
                  </div>
                  <div className="overflow-y-auto flex-1 divide-y divide-slate-100 bg-white">
                    {fileData.columns.map((col, idx) => {
                      const mappedField = Object.entries(mapping).find(([, v]) => v === col);
                      const fieldDef = mappedField ? BUG_FIELDS.find(f => f.key === mappedField[0]) : null;
                      const sampleVal = fileData.preview.find(r => r[idx]?.trim())?.[idx] ?? '';
                      return (
                        <div key={col} className={`flex items-start gap-3 px-3 py-2.5 transition-colors
                          ${fieldDef ? 'bg-green-50 hover:bg-green-100/70' : 'hover:bg-slate-50'}`}>
                          <span className="text-[11px] text-slate-400 w-5 text-right mt-0.5 shrink-0 font-mono">{idx + 1}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold truncate ${fieldDef ? 'text-slate-800' : 'text-slate-600'}`}>{col}</p>
                            {sampleVal && <p className="text-[11px] text-slate-400 truncate mt-0.5 italic">{sampleVal}</p>}
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

                {/* RIGHT: Bug fields */}
                <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white text-sm font-semibold shrink-0">
                    <Bug className="h-4 w-4" />
                    <span>Trường Bug</span>
                    <span className="ml-auto text-slate-400 text-xs font-normal">{mappedCount}/{BUG_FIELDS.length} đã map</span>
                  </div>
                  <div className="overflow-y-auto flex-1 bg-white">
                    {FIELD_GROUPS.map(group => {
                      const groupFields = BUG_FIELDS.filter(f => group.keys.includes(f.key));
                      const mappedInGroup = groupFields.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).length;
                      const GroupIcon = group.icon;
                      return (
                        <div key={group.label}>
                          <div className={`sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-t ${headerColors[group.color]}`}>
                            <GroupIcon className="h-3 w-3 shrink-0" />
                            <span className="text-[11px] font-semibold uppercase tracking-wide flex-1">{group.label}</span>
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                              ${mappedInGroup === groupFields.length ? 'bg-green-500 text-white' : mappedInGroup > 0 ? 'bg-white/80 text-current' : 'bg-white/60 text-current opacity-60'}`}>
                              {mappedInGroup}/{groupFields.length}
                            </span>
                          </div>
                          {groupFields.map(field => {
                            const isMapped = !!(mapping[field.key] && mapping[field.key] !== SKIP);
                            const isRequiredUnmapped = field.required && !isMapped;
                            const mappedCol = isMapped ? mapping[field.key] : null;
                            const colIdx = mappedCol != null ? fileData.columns.indexOf(mappedCol) : -1;
                            const sampleRaw = colIdx >= 0 ? (fileData.preview.find(r => r[colIdx]?.trim())?.[colIdx] ?? '') : '';
                            const sampleResolved = sampleRaw ? resolveField(field.key, sampleRaw) : '';
                            const wasConverted = !!(sampleRaw && sampleResolved && sampleRaw !== sampleResolved);

                            return (
                              <div key={field.key} className={`px-3 py-2 border-b last:border-b-0 transition-colors
                                ${isMapped ? 'bg-green-50/40' : isRequiredUnmapped ? 'bg-red-50/30' : 'hover:bg-slate-50/60'}`}>
                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMapped ? 'bg-green-500' : isRequiredUnmapped ? 'bg-red-400' : 'bg-slate-300'}`} />
                                  <span className={`text-[11px] leading-tight flex-1 ${field.required ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
                                    {field.label}
                                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                  </span>
                                  {isMapped && <Check className="h-3 w-3 shrink-0 text-green-500" />}
                                </div>
                                <Select value={mapping[field.key] ?? SKIP} onValueChange={val => setFieldMapping(field.key, val ?? SKIP)}>
                                  <SelectTrigger className={`h-7 text-xs w-full ${isMapped ? 'border-green-300 bg-white text-green-800 font-medium' : isRequiredUnmapped ? 'border-red-200 text-slate-400' : 'text-slate-400'}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={SKIP}>— Bỏ qua —</SelectItem>
                                    {fileData.columns.map(col => {
                                      const ci = fileData.columns.indexOf(col);
                                      const s = fileData.preview.find(r => r[ci]?.trim())?.[ci] ?? '';
                                      return (
                                        <SelectItem key={col} value={col}>
                                          {col}{s ? ` · ${s.length > 20 ? s.substring(0, 20) + '…' : s}` : ''}
                                        </SelectItem>
                                      );
                                    })}
                                  </SelectContent>
                                </Select>
                                {isMapped && sampleRaw && (
                                  <div className="mt-1 px-1">
                                    {wasConverted ? (
                                      <div className="flex items-center gap-1 text-[10px] text-amber-600">
                                        <span className="line-through opacity-60 truncate max-w-[40%]">{sampleRaw}</span>
                                        <span className="shrink-0">→</span>
                                        <span className="font-medium truncate">{sampleResolved}</span>
                                      </div>
                                    ) : (
                                      <div className="text-[10px] text-slate-400 italic truncate">{sampleResolved || sampleRaw}</div>
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
                  Xem trước {Math.min(previewRows.length, 8)} dòng đầu · tổng <strong>{fileData.allRows.length}</strong> bug sẽ được import
                </div>
                <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1.5">
                  <span>⚠</span> Import sẽ xóa toàn bộ bug cũ và thay thế bằng dữ liệu mới
                </div>
              </div>

              <div className="border rounded-lg overflow-auto max-h-[55vh]">
                <table className="text-[11px] w-full">
                  <thead className="bg-slate-50 border-b sticky top-0">
                    <tr>
                      {BUG_FIELDS.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).map(f => (
                        <th key={f.key} className="px-2 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-r last:border-r-0">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {BUG_FIELDS.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).map(f => {
                          const resolved = row.resolved[f.key] ?? '';
                          const rawVal = row.raw[f.key] ?? '';
                          const wasConverted = rawVal && resolved && rawVal !== resolved;
                          return (
                            <td key={f.key} className={`px-2 py-1.5 max-w-[180px] border-r last:border-r-0 ${wasConverted ? 'bg-amber-50' : ''}`}>
                              <div className="truncate font-medium text-slate-800">{resolved || '—'}</div>
                              {wasConverted && <div className="truncate text-[10px] text-amber-600 mt-0.5">← {rawVal}</div>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {(!mapping['summary'] || mapping['summary'] === SKIP) && (
                <div className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
                  Chưa map cột Summary (bắt buộc). Quay lại bước 2 để mapping.
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => { if (step === 1) onOpenChange(false); else setStep(s => (s - 1) as 1 | 2 | 3); }}>
            {step === 1 ? 'Hủy' : <><ChevronLeft className="h-4 w-4 mr-1" />Quay lại</>}
          </Button>
          <div className="flex-1" />
          {step === 1 && (
            <Button className="bg-red-500 hover:bg-red-600"
              disabled={importSource === 'file' ? !fileData : !textPreview?.columns.length}
              onClick={() => { if (importSource === 'text') handleParseText(); else setStep(2); }}>
              Tiếp theo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 2 && (
            <Button className="bg-red-500 hover:bg-red-600" onClick={() => setStep(3)}>
              Xem trước <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button className="bg-green-600 hover:bg-green-700"
              disabled={importing || !mapping['summary'] || mapping['summary'] === SKIP}
              onClick={handleImport}>
              {importing ? 'Đang import...' : `Import ${fileData?.allRows.length ?? 0} bug`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
