'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Upload, Save, Trash2, ChevronRight, ChevronLeft, FileSpreadsheet, Check,
  Calendar, Users, BarChart2, AlertTriangle, FileText, Info, Tag, ClipboardPaste,
} from 'lucide-react';

// ─── Activity fields definition ───────────────────────────────────────────────
export const ACTIVITY_FIELDS: { key: string; label: string; required?: boolean; virtual?: boolean }[] = [
  { key: 'activity',       label: 'Activity', required: true },
  { key: 'phase',          label: 'Phase' },
  { key: 'no',             label: 'No' },
  { key: 'deliverable',    label: 'Deliverable' },
  { key: 'sign_off_doc',   label: 'Sign-off Document' },
  { key: 'accountable',    label: 'Accountable' },
  { key: 'responsible',    label: 'Responsible' },
  { key: 'support',        label: 'Support' },
  { key: 'plan_start',     label: 'Plan Start (YYYY-MM-DD)' },
  { key: 'plan_end',       label: 'Plan End (YYYY-MM-DD)' },
  { key: 'actual_start',   label: 'Actual Start (YYYY-MM-DD)' },
  { key: 'actual_end',     label: 'Actual End (YYYY-MM-DD)' },
  { key: 'status',         label: 'Status' },
  { key: 'completion_pct', label: 'Completion (%)' },
  { key: 'delay_owner',    label: 'Delay Owner' },
  { key: 'delay_reason',   label: 'Delay Reason' },
  { key: 'notes',          label: 'Notes' },
  { key: 'jira_key',       label: 'Jira Key' },
  { key: 'sprint',         label: 'Sprint' },
  { key: '_issue_type',    label: 'Issue Type (EPIC / Story)', virtual: true },
  { key: '_parent',        label: 'Parent Key (EPIC → Phase)', virtual: true },
];

const FIELD_ALIASES: Record<string, string[]> = {
  no:             ['no', 'num', 'number', 'seq', 'stt', '#'],
  phase:          ['phase', 'stage', 'category', 'giai doan'],
  activity:       ['activity', 'task', 'name', 'ten', 'title', 'description', 'cong viec', 'job', 'summary'],
  deliverable:    ['deliverable', 'output', 'dau ra', 'result', 'artifact'],
  sign_off_doc:   ['sign off', 'signoff', 'sign-off', 'document', 'doc', 'bien ban'],
  accountable:    ['accountable', 'owner', 'account', 'chu tri', 'assignee', 'assigned to'],
  responsible:    ['responsible', 'person', 'phu trach'],
  support:        ['support', 'ho tro', 'helper'],
  plan_start:     ['plan start', 'planned start', 'start', 'begin', 'bat dau', 'ke hoach bat dau', 'start date', 'inferred start date'],
  plan_end:       ['plan end', 'planned end', 'end', 'finish', 'ket thuc', 'ke hoach ket thuc', 'end date', 'due date', 'inferred due date'],
  actual_start:   ['actual start', 'real start', 'thuc te bat dau', 'actual start date'],
  actual_end:     ['actual end', 'real end', 'thuc te ket thuc', 'actual end date'],
  status:         ['status', 'trang thai', 'state', 'tinh trang'],
  completion_pct: ['completion', 'percent', '%', 'progress', 'tien do', 'done', 'pct', 'complete'],
  delay_owner:    ['delay owner', 'owner delay', 'responsible for delay'],
  delay_reason:   ['delay reason', 'reason', 'ly do', 'cause'],
  notes:          ['notes', 'note', 'remark', 'ghi chu', 'comment', 'observation'],
  jira_key:       ['key', 'jira key', 'issue key', 'ticket', 'ticket id'],
  sprint:         ['sprint', 'sprint name', 'iteration'],
  _issue_type:    ['issue type', 'issuetype', 'type', 'loai van de'],
  _parent:        ['parent', 'epic link', 'parent link', 'parent issue'],
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

const STATUSES = [
  'New', 'To Do', 'To-do', 'REFINEMENT',
  'In Dev', 'In development', 'Ready For Dev', 'In Progress',
  'In Review', 'PENDING',
  'In Testing', 'Testing', 'Ready for Test', 'READY4TEST', 'STAGING-READY4TEST',
  'Re-Open',
  'Done', 'UAT', 'Deployed', 'QC Done', 'READY TO RELEASE', 'READY FOR RELEASE', 'Passed QC', 'ANBM',
  'Blocked', 'Deferred',
];
const DELAY_OWNERS = ['N/A', 'Client', 'Vendor', 'Both', 'External'];
const SKIP = '__skip__';

const FIELD_GROUPS: { label: string; icon: React.ComponentType<{ className?: string }>; keys: string[]; color: string }[] = [
  { label: 'Thông tin cơ bản', icon: Info,          keys: ['no', 'phase', 'activity', 'deliverable', 'sign_off_doc'], color: 'blue'   },
  { label: 'Phân công',        icon: Users,          keys: ['accountable', 'responsible', 'support'],                  color: 'purple' },
  { label: 'Ngày tháng',       icon: Calendar,       keys: ['plan_start', 'plan_end', 'actual_start', 'actual_end'],   color: 'orange' },
  { label: 'Tiến độ',          icon: BarChart2,      keys: ['status', 'completion_pct'],                               color: 'green'  },
  { label: 'Vấn đề trễ',       icon: AlertTriangle,  keys: ['delay_owner', 'delay_reason'],                            color: 'red'    },
  { label: 'Ghi chú',          icon: FileText,       keys: ['notes'],                                                  color: 'gray'   },
  { label: 'Jira Integration', icon: Tag,            keys: ['jira_key', 'sprint', '_issue_type', '_parent'],           color: 'teal'   },
];

// ─── Value normalizers ────────────────────────────────────────────────────────
function normalizeDate(raw: string): string {
  if (!raw) return '';
  const v = raw.trim();
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,4})$/);
  if (m) {
    const [, a, b, c] = m;
    const ai = parseInt(a);
    if (a.length === 4) return `${a}-${b.padStart(2, '0')}-${c.padStart(2, '0')}`;
    if (c.length === 4) {
      if (ai > 12) return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
      return `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }
  }
  const num = Number(v);
  if (!isNaN(num) && num > 1 && num < 2958466) {
    const d = new Date(Math.round((num - 25569) * 86400000));
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const parsed = new Date(v);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return '';
}

const norm = (s: string) => s.toLowerCase().replace(/[\s_\-\/\.]/g, '');

const STATUS_MAP: Record<string, string> = {
  // Chưa làm
  new: 'New', notstarted: 'New', open: 'New',
  todo: 'To-do', tostart: 'To-do',
  refinement: 'REFINEMENT', refining: 'REFINEMENT', grooming: 'REFINEMENT', backlog: 'REFINEMENT',
  // Đang làm
  indev: 'In Dev', developing: 'In Dev',
  indevelopment: 'In development', development: 'In development',
  readyfordev: 'Ready For Dev', readydev: 'Ready For Dev',
  inprogress: 'In Progress', wip: 'In Progress', ongoing: 'In Progress',
  processing: 'In Progress', running: 'In Progress',
  // Giữa chừng
  inreview: 'In Review', review: 'In Review', reviewing: 'In Review', codereview: 'In Review',
  pending: 'PENDING',
  // Đang test
  intesting: 'In Testing', qa: 'In Testing', qc: 'In Testing',
  testing: 'Testing',
  readyfortest: 'Ready for Test', readytest: 'Ready for Test',
  ready4test: 'READY4TEST', r4t: 'READY4TEST',
  staging: 'STAGING-READY4TEST', stagingready: 'STAGING-READY4TEST',
  // Gần xong
  reopen: 'Re-Open', reopened: 'Re-Open',
  // Hoàn thành
  done: 'Done', complete: 'Done', completed: 'Done', finished: 'Done', closed: 'Done',
  uat: 'UAT', useracceptancetesting: 'UAT',
  deployed: 'Deployed', deploy: 'Deployed', live: 'Deployed', production: 'Deployed',
  qcdone: 'QC Done',
  passedqc: 'Passed QC', passed: 'Passed QC',
  readytorelease: 'READY TO RELEASE', rtr: 'READY TO RELEASE',
  readyforrelease: 'READY FOR RELEASE', rfr: 'READY FOR RELEASE',
  anbm: 'ANBM',
  // Đặc biệt
  blocked: 'Blocked', stuck: 'Blocked', onhold: 'Blocked', hold: 'Blocked',
  deferred: 'Deferred', postponed: 'Deferred', delayed: 'Deferred',
  cancelled: 'Deferred', cancel: 'Deferred', skipped: 'Deferred',
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

function fuzzyDelayOwner(raw: string): string {
  if (!raw) return 'N/A';
  const n = norm(raw);
  if (DELAY_OWNERS.includes(raw)) return raw;
  return DELAY_MAP[n] ?? DELAY_MAP[Object.keys(DELAY_MAP).find(k => n.startsWith(k) || k.startsWith(n)) ?? ''] ?? 'N/A';
}

function resolveField(field: string, raw: string, statusOverrides?: Record<string, string>): string {
  switch (field) {
    case 'plan_start': case 'plan_end': case 'actual_start': case 'actual_end':
      return normalizeDate(raw);
    case 'status':
      return (statusOverrides?.[raw]) ?? fuzzyStatus(raw);
    case 'delay_owner': return fuzzyDelayOwner(raw);
    default: return raw;
  }
}

// ─── CSV Parser (client-side) ─────────────────────────────────────────────────
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
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    rows.push(cells);
  }
  if (rows.length < 1) return { columns: [], allRows: [], preview: [] };
  const columns = rows[0];
  const dataRows = rows.slice(1).filter(r => r.some(c => c));
  return { columns, allRows: dataRows, preview: dataRows.slice(0, 10) };
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
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const [existingJiraKeys, setExistingJiraKeys] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep(1); setFileData(null); setFileName(''); setMapping({});
    setSaveName(''); setUploading(false); setImporting(false);
    setStatusOverrides({}); setPastedText(''); setImportSource('file');
  }, []);

  useEffect(() => { if (!open) reset(); }, [open, reset]);

  useEffect(() => {
    if (open) {
      fetch('/api/import-mapping').then(r => r.json()).then(setSavedMappings).catch(() => {});
      fetch(`/api/projects/${projectId}/activities/import`)
        .then(r => r.json())
        .then((keys: string[]) => setExistingJiraKeys(new Set(keys)))
        .catch(() => {});
    }
  }, [open, projectId]);

  // ── Live text parse preview ────────────────────────────────────────────────
  const textPreview = useMemo(() => {
    if (!pastedText.trim()) return null;
    return parseCSVText(pastedText);
  }, [pastedText]);

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
      setMapping(autoSuggestMapping(data.columns));
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

  const handleParseText = () => {
    if (!pastedText.trim()) { toast.error('Chưa có nội dung để phân tích'); return; }
    const data = parseCSVText(pastedText);
    if (!data.columns.length) { toast.error('Không tìm thấy cột nào trong nội dung'); return; }
    setFileName('(paste từ clipboard)');
    setFileData(data);
    setMapping(autoSuggestMapping(data.columns));
    setStep(2);
  };

  // ── Step 2: Mapping helpers ────────────────────────────────────────────────
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

  // ── Jira hierarchy processing ──────────────────────────────────────────────
  const jiraMode = !!(mapping['_issue_type'] && mapping['_issue_type'] !== SKIP);

  const { epicMap, importRows } = useMemo(() => {
    if (!fileData || !jiraMode) return { epicMap: {} as Record<string, string>, importRows: fileData?.allRows ?? [] };
    const issueTypeIdx = fileData.columns.indexOf(mapping['_issue_type']);
    const jiraKeyIdx = mapping['jira_key'] && mapping['jira_key'] !== SKIP
      ? fileData.columns.indexOf(mapping['jira_key']) : -1;
    const activityIdx = mapping['activity'] && mapping['activity'] !== SKIP
      ? fileData.columns.indexOf(mapping['activity']) : -1;

    const epics: Record<string, string> = {};
    for (const row of fileData.allRows) {
      const issueType = issueTypeIdx >= 0 ? (row[issueTypeIdx]?.trim().toLowerCase() ?? '') : '';
      if (issueType === 'epic') {
        const key = jiraKeyIdx >= 0 ? (row[jiraKeyIdx]?.trim() ?? '') : '';
        const summary = activityIdx >= 0 ? (row[activityIdx]?.trim() ?? '') : '';
        if (key && summary) epics[key] = summary;
      }
    }

    const stories = fileData.allRows.filter(row => {
      const issueType = issueTypeIdx >= 0 ? (row[issueTypeIdx]?.trim().toLowerCase() ?? '') : '';
      return issueType !== 'epic';
    });

    return { epicMap: epics, importRows: stories };
  }, [fileData, jiraMode, mapping]);

  const getRowPhase = useCallback((row: string[]): string => {
    if (!fileData) return 'General';
    if (jiraMode) {
      const parentIdx = mapping['_parent'] && mapping['_parent'] !== SKIP
        ? fileData.columns.indexOf(mapping['_parent']) : -1;
      const parentKey = parentIdx >= 0 ? (row[parentIdx]?.trim() ?? '') : '';
      return epicMap[parentKey] || parentKey || 'General';
    }
    const phaseCol = mapping['phase'];
    if (!phaseCol || phaseCol === SKIP) return 'General';
    const idx = fileData.columns.indexOf(phaseCol);
    const raw = idx >= 0 ? (row[idx]?.trim() ?? '') : '';
    return raw || 'General';
  }, [fileData, jiraMode, mapping, epicMap]);

  // ── Unique statuses for status mapping UI ──────────────────────────────────
  const uniqueStatusValues = useMemo(() => {
    if (!fileData || !mapping['status'] || mapping['status'] === SKIP) return [];
    const statusCol = fileData.columns.indexOf(mapping['status']);
    if (statusCol < 0) return [];
    const seen = new Map<string, number>();
    for (const row of fileData.allRows) {
      const v = row[statusCol]?.trim() ?? '';
      if (v) seen.set(v, (seen.get(v) ?? 0) + 1);
    }
    return Array.from(seen.entries()).map(([raw, count]) => ({
      raw, count, autoMapped: fuzzyStatus(raw),
    }));
  }, [fileData, mapping]);

  // ── Step 3: Preview ────────────────────────────────────────────────────────
  const previewRows = useMemo(() => {
    if (!fileData) return [];
    const rows = jiraMode ? importRows : fileData.allRows;
    return rows.slice(0, 8).map(row => {
      const obj: Record<string, string> = {};
      const raw: Record<string, string> = {};
      for (const field of ACTIVITY_FIELDS) {
        if (field.virtual) continue;
        const col = mapping[field.key];
        if (col && col !== SKIP) {
          const idx = fileData.columns.indexOf(col);
          const rawVal = idx >= 0 ? (row[idx]?.trim() ?? '') : '';
          raw[field.key] = rawVal;
          obj[field.key] = resolveField(field.key, rawVal, statusOverrides);
        }
      }
      if (jiraMode) obj['phase'] = getRowPhase(row);
      return { resolved: obj, raw };
    });
  }, [fileData, importRows, jiraMode, mapping, statusOverrides, getRowPhase]);

  // ── Upsert stats ───────────────────────────────────────────────────────────
  const upsertStats = useMemo(() => {
    if (!fileData) return { newCount: 0, overwriteCount: 0 };
    const rows = jiraMode ? importRows : fileData.allRows;
    const jiraKeyCol = mapping['jira_key'];
    const jiraKeyIdx = jiraKeyCol && jiraKeyCol !== SKIP ? fileData.columns.indexOf(jiraKeyCol) : -1;
    const activityCol = mapping['activity'];
    const activityIdx = activityCol && activityCol !== SKIP ? fileData.columns.indexOf(activityCol) : -1;

    let newCount = 0, overwriteCount = 0;
    for (const row of rows) {
      if (activityIdx >= 0 && !row[activityIdx]?.trim()) continue;
      const key = jiraKeyIdx >= 0 ? (row[jiraKeyIdx]?.trim() ?? '') : '';
      if (key && existingJiraKeys.has(key)) overwriteCount++;
      else newCount++;
    }
    return { newCount, overwriteCount };
  }, [fileData, importRows, jiraMode, mapping, existingJiraKeys]);

  // ── Import ─────────────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!fileData) return;
    const activityCol = mapping['activity'];
    if (!activityCol || activityCol === SKIP) {
      toast.error('Vui lòng map cột Activity');
      return;
    }

    setImporting(true);
    const rows = jiraMode ? importRows : fileData.allRows;
    const activityIdx = fileData.columns.indexOf(activityCol);

    const get = (row: string[], field: string): string => {
      const col = mapping[field];
      if (!col || col === SKIP) return '';
      const idx = fileData.columns.indexOf(col);
      return idx >= 0 ? (row[idx]?.trim() ?? '') : '';
    };

    const activities = rows
      .filter(row => row[activityIdx]?.trim())
      .map(row => ({
        phase:         jiraMode ? getRowPhase(row) : (get(row, 'phase') || 'General'),
        no:            get(row, 'no'),
        activity:      get(row, 'activity'),
        deliverable:   get(row, 'deliverable'),
        sign_off_doc:  get(row, 'sign_off_doc'),
        accountable:   get(row, 'accountable'),
        responsible:   get(row, 'responsible'),
        support:       get(row, 'support'),
        plan_start:    normalizeDate(get(row, 'plan_start')),
        plan_end:      normalizeDate(get(row, 'plan_end')),
        actual_start:  normalizeDate(get(row, 'actual_start')),
        actual_end:    normalizeDate(get(row, 'actual_end')),
        status:        resolveField('status', get(row, 'status'), statusOverrides),
        completion_pct: Number(get(row, 'completion_pct').replace('%', '')) || 0,
        delay_owner:   fuzzyDelayOwner(get(row, 'delay_owner')),
        delay_reason:  get(row, 'delay_reason'),
        notes:         get(row, 'notes'),
        jira_key:      get(row, 'jira_key'),
        sprint:        get(row, 'sprint'),
      }));

    try {
      const res = await fetch(`/api/projects/${projectId}/activities/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities }),
      });
      const result = await res.json();
      if (result.errors?.length) {
        toast.error(`Import xong với ${result.errors.length} lỗi`);
      } else {
        const parts = [];
        if (result.inserted > 0) parts.push(`${result.inserted} mới`);
        if (result.updated > 0) parts.push(`${result.updated} cập nhật`);
        toast.success(`Import thành công: ${parts.join(', ')}`);
      }
    } catch {
      toast.error('Import thất bại');
    }

    setImporting(false);
    onImported();
    onOpenChange(false);
  };

  const mappedCount = ACTIVITY_FIELDS.filter(f => !f.virtual && mapping[f.key] && mapping[f.key] !== SKIP).length;

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
            {(['Upload / Paste', 'Map cột', 'Xem trước & Import'] as const).map((label, i) => (
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

          {/* ── Step 1: Source selection ──────────────────────────────────────── */}
          {step === 1 && (
            <div className="flex flex-col gap-4 h-full">
              {/* Source tabs */}
              <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 w-fit">
                <button
                  onClick={() => setImportSource('file')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                    importSource === 'file' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Upload className="h-3.5 w-3.5" /> Upload file
                </button>
                <button
                  onClick={() => setImportSource('text')}
                  className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                    importSource === 'text' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <ClipboardPaste className="h-3.5 w-3.5" /> Paste text
                </button>
              </div>

              {/* File upload mode */}
              {importSource === 'file' && (
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
                    ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(f); e.target.value = ''; }}
                  />
                  {uploading && <div className="text-center text-sm text-blue-600 animate-pulse">Đang đọc file...</div>}
                  <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
                    <p className="font-medium text-slate-600">Lưu ý:</p>
                    <p>• Hệ thống tự động tìm dòng header — bỏ qua các dòng trống ở đầu file</p>
                    <p>• Hỗ trợ mọi cấu trúc file: tên cột bất kỳ, thứ tự tuỳ ý</p>
                    <p>• Bước tiếp theo bạn chỉ cần kéo thả / chọn dropdown để map từng cột</p>
                  </div>
                </div>
              )}

              {/* Text paste mode */}
              {importSource === 'text' && (
                <div className="flex flex-col gap-3 flex-1 min-h-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">Paste nội dung CSV từ Jira hoặc bất kỳ công cụ nào vào ô bên dưới</span>
                    {textPreview && textPreview.columns.length > 0 && (
                      <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full ml-auto">
                        ✓ {textPreview.columns.length} cột · {textPreview.allRows.length} dòng
                      </span>
                    )}
                  </div>
                  <textarea
                    className="flex-1 font-mono text-xs border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-slate-50"
                    placeholder={`Paste CSV ở đây. Ví dụ Jira:\n"Key","Issue Type","Parent","Summary","Status","Assignee","Sprint","Start date","Due date"\n"PROJ-1","Epic","","Tên Epic","New","Nguyen Van A","","2026/01/01","2026/03/31"\n"PROJ-2","Story","PROJ-1","Tên Story","In Progress","","Sprint 1","2026/01/01","2026/01/31"`}
                    value={pastedText}
                    onChange={e => setPastedText(e.target.value)}
                  />

                  {/* Mini preview */}
                  {textPreview && textPreview.columns.length > 0 && (
                    <div className="border border-slate-200 rounded-lg overflow-auto max-h-36 bg-white">
                      <table className="text-[10px] w-full">
                        <thead className="bg-slate-50 border-b">
                          <tr>
                            {textPreview.columns.slice(0, 8).map((col, i) => (
                              <th key={i} className="px-2 py-1.5 text-left font-semibold text-slate-600 border-r last:border-r-0 whitespace-nowrap">{col}</th>
                            ))}
                            {textPreview.columns.length > 8 && <th className="px-2 py-1.5 text-slate-400">+{textPreview.columns.length - 8} cột</th>}
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

                  <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 text-xs text-teal-700 space-y-1">
                    <p className="font-semibold">Hỗ trợ cấu trúc Jira:</p>
                    <p>• Dòng <strong>Epic</strong> → trở thành <strong>Phase</strong> trong timeline</p>
                    <p>• Dòng <strong>Story/Task</strong> có Parent → trở thành <strong>Activity</strong> thuộc Phase tương ứng</p>
                    <p>• Map cột <em>Issue Type</em> và <em>Parent</em> ở bước 2 để bật chế độ này</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Mapping ────────────────────────────────────────────────── */}
          {step === 2 && fileData && (
            <div className="flex flex-col gap-3 h-full">

              {/* Top bar */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs shrink-0">
                  <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />
                  <span className="font-medium text-blue-700 max-w-[200px] truncate">{fileName}</span>
                  <span className="text-blue-400">·</span>
                  <span className="text-blue-600">{fileData.columns.length} cột</span>
                  <span className="text-blue-400">·</span>
                  <span className="text-blue-600">{fileData.allRows.length} dòng</span>
                </div>

                {jiraMode && (
                  <div className="flex items-center gap-1 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 text-xs text-teal-700 shrink-0">
                    <Tag className="h-3.5 w-3.5" />
                    <span className="font-medium">Jira Mode:</span>
                    <span>{Object.keys(epicMap).length} Epic → Phase · {importRows.length} Story → Activity</span>
                  </div>
                )}

                <div className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs shrink-0 border
                  ${mappedCount > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
                  <Check className="h-3.5 w-3.5" />
                  {mappedCount}/{ACTIVITY_FIELDS.filter(f => !f.virtual).length} trường đã map
                </div>

                <button
                  className="text-xs text-blue-500 hover:text-blue-700 hover:underline px-2 py-1 shrink-0"
                  onClick={() => setMapping(autoSuggestMapping(fileData.columns))}
                >
                  Gợi ý tự động
                </button>

                <div className="flex-1" />

                {savedMappings.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] text-slate-400 shrink-0">Template:</span>
                    {savedMappings.map(tpl => (
                      <div key={tpl.id} className="flex items-center bg-white border border-slate-200 rounded-md overflow-hidden text-xs">
                        <button className="px-2 py-1 text-blue-600 hover:bg-blue-50 font-medium" onClick={() => applyTemplate(tpl)}>{tpl.name}</button>
                        <button onClick={() => deleteTemplate(tpl.id)} className="px-1.5 py-1 text-slate-300 hover:text-red-500 hover:bg-red-50 border-l border-slate-200"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-1 shrink-0">
                  <Input className="h-7 text-xs w-40" placeholder="Tên template..." value={saveName}
                    onChange={e => setSaveName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') saveTemplate(); }} />
                  <Button size="sm" variant="outline" onClick={saveTemplate} disabled={saving || !saveName.trim()} className="gap-1 h-7 text-xs px-2">
                    <Save className="h-3 w-3" />{saving ? '...' : 'Lưu'}
                  </Button>
                </div>
              </div>

              {/* Two-panel mapping area */}
              <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">

                {/* LEFT PANEL: File columns */}
                <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold shrink-0">
                    <FileSpreadsheet className="h-4 w-4" />
                    <span>Cột trong file / text</span>
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

                {/* RIGHT PANEL: Timeline mapping */}
                <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white text-sm font-semibold shrink-0">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                    <span>Trường trong Timeline</span>
                    <span className="ml-auto text-slate-400 text-xs font-normal">{mappedCount}/{ACTIVITY_FIELDS.filter(f => !f.virtual).length} đã map</span>
                  </div>
                  <div className="overflow-y-auto flex-1 bg-white">
                    {FIELD_GROUPS.map(group => {
                      const groupFields = ACTIVITY_FIELDS.filter(f => group.keys.includes(f.key));
                      const nonVirtualFields = groupFields.filter(f => !f.virtual);
                      const mappedInGroup = nonVirtualFields.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).length;
                      const jiraVirtualMapped = groupFields.filter(f => f.virtual && mapping[f.key] && mapping[f.key] !== SKIP).length;
                      const GroupIcon = group.icon;

                      const headerColor: Record<string, string> = {
                        blue:   'text-blue-700 bg-blue-50 border-blue-100',
                        purple: 'text-purple-700 bg-purple-50 border-purple-100',
                        orange: 'text-orange-700 bg-orange-50 border-orange-100',
                        green:  'text-green-700 bg-green-50 border-green-100',
                        red:    'text-red-700 bg-red-50 border-red-100',
                        gray:   'text-slate-500 bg-slate-50 border-slate-100',
                        teal:   'text-teal-700 bg-teal-50 border-teal-100',
                      };
                      const dotDefault: Record<string, string> = {
                        blue: 'bg-blue-300', purple: 'bg-purple-300', orange: 'bg-orange-300',
                        green: 'bg-green-300', red: 'bg-red-300', gray: 'bg-slate-200', teal: 'bg-teal-300',
                      };

                      return (
                        <div key={group.label}>
                          <div className={`sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-t ${headerColor[group.color]}`}>
                            <GroupIcon className="h-3 w-3 shrink-0" />
                            <span className="text-[11px] font-semibold uppercase tracking-wide flex-1">{group.label}</span>
                            {group.color === 'teal' && jiraVirtualMapped > 0 && (
                              <span className="text-[10px] bg-teal-500 text-white px-1.5 py-0.5 rounded-full">Jira Mode</span>
                            )}
                            {nonVirtualFields.length > 0 && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                                ${mappedInGroup === nonVirtualFields.length
                                  ? 'bg-green-500 text-white'
                                  : mappedInGroup > 0 ? 'bg-white/80 text-current' : 'bg-white/60 text-current opacity-60'}`}>
                                {mappedInGroup}/{nonVirtualFields.length}
                              </span>
                            )}
                          </div>

                          {groupFields.map(field => {
                            const isMapped = !!(mapping[field.key] && mapping[field.key] !== SKIP);
                            const isRequiredUnmapped = field.required && !isMapped;
                            const mappedCol = isMapped ? mapping[field.key] : null;
                            const colIdx = mappedCol != null ? fileData.columns.indexOf(mappedCol) : -1;
                            const sampleRaw = colIdx >= 0
                              ? (fileData.preview.find((r: string[]) => r[colIdx]?.trim())?.[colIdx] ?? '')
                              : '';
                            const sampleResolved = sampleRaw && !field.virtual ? resolveField(field.key, sampleRaw, statusOverrides) : sampleRaw;
                            const wasConverted = !!(sampleRaw && sampleResolved && sampleRaw !== sampleResolved);

                            return (
                              <div key={field.key} className={`px-3 py-2 border-b last:border-b-0 transition-colors
                                ${field.virtual ? 'bg-teal-50/30' : ''}
                                ${isMapped ? (field.virtual ? 'bg-teal-50' : 'bg-green-50/40') : isRequiredUnmapped ? 'bg-red-50/30' : 'hover:bg-slate-50/60'}`}>

                                <div className="flex items-center gap-1.5 mb-1.5">
                                  <div className={`w-1.5 h-1.5 rounded-full shrink-0
                                    ${isMapped ? (field.virtual ? 'bg-teal-500' : 'bg-green-500') : isRequiredUnmapped ? 'bg-red-400' : dotDefault[group.color]}`} />
                                  <span className={`text-[11px] leading-tight flex-1
                                    ${field.required ? 'font-semibold text-slate-800' : field.virtual ? 'text-teal-700' : 'text-slate-500'}`}>
                                    {field.label}
                                    {field.required && <span className="text-red-500 ml-0.5">*</span>}
                                    {field.virtual && <span className="ml-1 text-[9px] bg-teal-100 text-teal-600 px-1 rounded">Jira</span>}
                                  </span>
                                  {isMapped && <Check className={`h-3 w-3 shrink-0 ${field.virtual ? 'text-teal-500' : 'text-green-500'}`} />}
                                </div>

                                <Select
                                  value={mapping[field.key] ?? SKIP}
                                  onValueChange={(val: string | null) => setFieldMapping(field.key, val ?? SKIP)}
                                >
                                  <SelectTrigger className={`h-7 text-xs w-full
                                    ${isMapped
                                      ? field.virtual ? 'border-teal-300 bg-white text-teal-800 font-medium' : 'border-green-300 bg-white text-green-800 font-medium'
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

                                {isMapped && !field.virtual && (
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

                    {/* Status value mapping section */}
                    {uniqueStatusValues.length > 0 && (
                      <div className="border-t-2 border-green-200 mt-1">
                        <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-green-50 border-b border-green-100">
                          <BarChart2 className="h-3 w-3 text-green-600 shrink-0" />
                          <span className="text-[11px] font-semibold uppercase tracking-wide text-green-700 flex-1">
                            Mapping giá trị Status
                          </span>
                          <span className="text-[10px] text-green-600">{uniqueStatusValues.length} giá trị</span>
                        </div>
                        <div className="divide-y divide-slate-100">
                          {uniqueStatusValues.map(({ raw, count, autoMapped }) => {
                            const override = statusOverrides[raw] ?? '';
                            const mapped = override || autoMapped;
                            const isExact = STATUSES.includes(raw);
                            return (
                              <div key={raw} className="px-3 py-2 flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <span className={`text-xs font-mono truncate ${isExact ? 'text-green-700' : 'text-slate-600'}`}>{raw}</span>
                                    <span className="text-[10px] text-slate-300">×{count}</span>
                                  </div>
                                </div>
                                <span className="text-slate-300 text-xs">→</span>
                                <Select
                                  value={override || autoMapped}
                                  onValueChange={(val: string | null) => {
                                    const v = val ?? autoMapped;
                                    if (v === autoMapped) {
                                      setStatusOverrides(prev => { const n = { ...prev }; delete n[raw]; return n; });
                                    } else {
                                      setStatusOverrides(prev => ({ ...prev, [raw]: v }));
                                    }
                                  }}
                                >
                                  <SelectTrigger className={`h-6 text-xs w-36 ${override ? 'border-amber-300 text-amber-700' : 'border-green-200 text-green-700'}`}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="max-h-72">
                                    <SelectGroup>
                                      <SelectLabel className="text-[10px] text-slate-400 py-1">Chưa làm</SelectLabel>
                                      {['New', 'To Do', 'To-do', 'REFINEMENT'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectGroup>
                                    <SelectSeparator />
                                    <SelectGroup>
                                      <SelectLabel className="text-[10px] text-slate-400 py-1">Đang làm</SelectLabel>
                                      {['In Dev', 'In development', 'Ready For Dev', 'In Progress'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectGroup>
                                    <SelectSeparator />
                                    <SelectGroup>
                                      <SelectLabel className="text-[10px] text-slate-400 py-1">Giữa chừng</SelectLabel>
                                      {['In Review', 'PENDING'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectGroup>
                                    <SelectSeparator />
                                    <SelectGroup>
                                      <SelectLabel className="text-[10px] text-slate-400 py-1">Đang test</SelectLabel>
                                      {['In Testing', 'Testing', 'Ready for Test', 'READY4TEST', 'STAGING-READY4TEST'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectGroup>
                                    <SelectSeparator />
                                    <SelectGroup>
                                      <SelectLabel className="text-[10px] text-slate-400 py-1">Gần xong</SelectLabel>
                                      {['Re-Open'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectGroup>
                                    <SelectSeparator />
                                    <SelectGroup>
                                      <SelectLabel className="text-[10px] text-slate-400 py-1">Hoàn thành</SelectLabel>
                                      {['Done', 'UAT', 'Deployed', 'QC Done', 'READY TO RELEASE', 'READY FOR RELEASE', 'Passed QC', 'ANBM'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectGroup>
                                    <SelectSeparator />
                                    <SelectGroup>
                                      <SelectLabel className="text-[10px] text-slate-400 py-1">Đặc biệt</SelectLabel>
                                      {['Blocked', 'Deferred'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                                {!override && !isExact && (
                                  <span className="text-[9px] text-amber-500 shrink-0">auto</span>
                                )}
                                {override && (
                                  <button className="text-[9px] text-slate-400 hover:text-red-500 shrink-0"
                                    onClick={() => setStatusOverrides(prev => { const n = { ...prev }; delete n[raw]; return n; })}>
                                    reset
                                  </button>
                                )}
                                {isExact && <Check className="h-3 w-3 text-green-500 shrink-0" />}
                              </div>
                            );
                          })}
                        </div>
                        <div className="px-3 py-2 text-[10px] text-slate-400 italic bg-slate-50">
                          Thay đổi mapping nếu muốn — mặc định dựa trên nhận dạng tự động
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Step 3: Preview ────────────────────────────────────────────────── */}
          {step === 3 && fileData && (
            <div className="space-y-3">
              {/* Stats bar */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="text-xs text-slate-500 bg-slate-50 rounded px-3 py-2">
                  Xem trước {Math.min(previewRows.length, 8)} dòng đầu · tổng <strong>{jiraMode ? importRows.length : fileData.allRows.length}</strong> dòng
                  {jiraMode && <span className="ml-1 text-teal-600">· {Object.keys(epicMap).length} Epic bỏ qua (→ Phase)</span>}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-300 shrink-0" />
                  Giá trị được tự động chuẩn hoá (ngày, status…)
                </div>
              </div>

              {/* Upsert warning */}
              {upsertStats.overwriteCount > 0 && (
                <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2.5 text-xs text-orange-800">
                  <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                  <div>
                    <span className="font-semibold">{upsertStats.overwriteCount} dòng sẽ bị ghi đè</span>
                    <span className="text-orange-600"> (Jira Key đã tồn tại) · </span>
                    <span className="font-semibold text-green-700">{upsertStats.newCount} dòng mới</span>
                  </div>
                </div>
              )}

              {upsertStats.overwriteCount === 0 && (upsertStats.newCount > 0) && (
                <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-xs text-green-800">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="font-semibold">{upsertStats.newCount} activity mới</span>
                  <span className="text-green-600">· Không có key nào bị ghi đè</span>
                </div>
              )}

              <div className="border rounded-lg overflow-auto max-h-[55vh]">
                <table className="text-[11px] w-full">
                  <thead className="bg-slate-50 border-b sticky top-0">
                    <tr>
                      {jiraMode && <th className="px-2 py-2 text-left font-semibold text-teal-600 whitespace-nowrap border-r">Phase (từ Epic)</th>}
                      {ACTIVITY_FIELDS.filter(f => !f.virtual && mapping[f.key] && mapping[f.key] !== SKIP).map(f => (
                        <th key={f.key} className="px-2 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-r last:border-r-0">
                          {f.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewRows.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50">
                        {jiraMode && (
                          <td className="px-2 py-1.5 border-r">
                            <div className="text-[11px] font-medium text-teal-700 max-w-[120px] truncate">{row.resolved['phase'] || '—'}</div>
                          </td>
                        )}
                        {ACTIVITY_FIELDS.filter(f => !f.virtual && mapping[f.key] && mapping[f.key] !== SKIP).map(f => {
                          const resolved = row.resolved[f.key] ?? '';
                          const rawVal   = row.raw[f.key] ?? '';
                          const wasConverted = rawVal && resolved && rawVal !== resolved;
                          return (
                            <td key={f.key} className={`px-2 py-1.5 max-w-[150px] border-r last:border-r-0 ${wasConverted ? 'bg-amber-50' : ''}`}>
                              <div className="truncate font-medium text-slate-800">{resolved || '—'}</div>
                              {wasConverted && (
                                <div className="truncate text-[10px] text-amber-600 mt-0.5" title={`Gốc: ${rawVal}`}>← {rawVal}</div>
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
              ) : null}
            </div>
          )}
        </div>

        {/* Footer navigation */}
        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => { if (step === 1) onOpenChange(false); else setStep(s => (s - 1) as 1 | 2 | 3); }}>
            {step === 1 ? 'Hủy' : <><ChevronLeft className="h-4 w-4 mr-1" />Quay lại</>}
          </Button>
          <div className="flex-1" />
          {step === 1 && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={importSource === 'file' ? !fileData : !textPreview?.columns.length}
              onClick={() => {
                if (importSource === 'text') handleParseText();
                else setStep(2);
              }}
            >
              Tiếp theo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 2 && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => setStep(3)}
            >
              Xem trước <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={importing || !mapping['activity'] || mapping['activity'] === SKIP}
              onClick={handleImport}
            >
              {importing ? 'Đang import...' : `Import ${upsertStats.newCount + upsertStats.overwriteCount} dòng`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
