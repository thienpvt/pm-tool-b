'use client';
import React, { useState, useCallback, KeyboardEvent } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  RefreshCw, X, ChevronRight, ChevronLeft, Search, Loader2,
  AlertCircle, CheckCircle2, Filter, Database, Check,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface JiraSyncDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  mode: 'timeline' | 'bug';
  onSynced: () => void;
}

type Operator = '=' | '!=' | 'in' | 'not in';

interface FilterField {
  op: Operator;
  values: string[];
}

interface FilterState {
  projectKey: string;
  labels: FilterField;
  component: FilterField;
  issueTypes: string[];
  status: FilterField;
}

interface JiraIssue {
  id: string;
  key: string;
  fields: {
    summary: string;
    issuetype: { name: string };
    status: { name: string };
    assignee: { displayName: string } | null;
    reporter: { displayName: string } | null;
    priority: { name: string } | null;
    labels: string[];
    components: { name: string }[];
    parent?: { key: string };
    customfield_10014?: string;   // Epic Link (classic projects)
    customfield_10016?: number;   // Story Points
    customfield_10020?: Array<{ name: string; state: string }> | string; // Sprint
    resolution?: { name: string } | null;
    created: string;
    duedate?: string | null;
  };
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const ISSUE_TYPES = ['Epic', 'Story', 'Task', 'Bug', 'Sub-task'];
const OPERATORS: { value: Operator; label: string }[] = [
  { value: '=',      label: '= (bằng)'          },
  { value: '!=',     label: '!= (khác)'          },
  { value: 'in',     label: 'in (thuộc)'         },
  { value: 'not in', label: 'not in (không thuộc)' },
];
const COMMON_STATUSES = [
  'To Do', 'In Progress', 'Done', 'In Review', 'Blocked',
  'Ready for Test', 'Closed', 'Resolved', "Won't Fix", 'Reopen',
];
const TYPE_COLORS: Record<string, string> = {
  Epic:       'bg-purple-100 text-purple-700',
  Story:      'bg-green-100 text-green-700',
  Task:       'bg-blue-100 text-blue-700',
  Bug:        'bg-red-100 text-red-700',
  'Sub-task': 'bg-orange-100 text-orange-700',
};

// ─── JQL Builder ───────────────────────────────────────────────────────────────
function buildClause(field: string, { op, values }: FilterField): string {
  if (!values.length) return '';
  if (values.length === 1 && (op === '=' || op === '!=')) {
    return `${field} ${op} "${values[0]}"`;
  }
  const actualOp = op === '=' ? 'in' : op === '!=' ? 'not in' : op;
  return `${field} ${actualOp} (${values.map(v => `"${v}"`).join(', ')})`;
}

function buildJQL(f: FilterState): string {
  if (!f.projectKey.trim()) return '';
  const clauses: string[] = [`project = "${f.projectKey.trim().toUpperCase()}"`];
  const lbl = buildClause('labels',    f.labels);    if (lbl) clauses.push(lbl);
  const cmp = buildClause('component', f.component); if (cmp) clauses.push(cmp);
  if (f.issueTypes.length) {
    clauses.push(`issuetype in (${f.issueTypes.join(', ')})`);
  }
  const sts = buildClause('status', f.status); if (sts) clauses.push(sts);
  return clauses.join(' AND ') + ' ORDER BY created ASC';
}

// ─── Field Mapping: Jira → PM tool ────────────────────────────────────────────
function isoToDate(raw: string | null | undefined): string {
  if (!raw) return '';
  const d = new Date(raw);
  return isNaN(d.getTime()) ? '' : d.toISOString().split('T')[0];
}

function sprintName(sprint: JiraIssue['fields']['customfield_10020']): string {
  if (!sprint) return '';
  if (Array.isArray(sprint) && sprint.length > 0) return sprint[0].name ?? '';
  if (typeof sprint === 'string') {
    const m = sprint.match(/name=([^,\]]+)/);
    return m ? m[1].trim() : '';
  }
  return '';
}

function normalizeTimelineStatus(raw: string): string {
  const n = raw.toLowerCase().replace(/[\s\-_]+/g, '');
  if (['todo','notstarted','open','new','backlog'].includes(n)) return 'To-do';
  if (['inprogress','wip','active','started','inreview','review'].includes(n)) return 'In Progress';
  if (['indev','indevelopment','development'].includes(n)) return 'In Dev';
  if (['done','completed','closed','finished'].includes(n)) return 'Done';
  if (['resolved','fixed'].includes(n)) return 'Done';
  if (['blocked','stuck'].includes(n)) return 'Blocked';
  return 'To-do';
}

function normalizeBugStatus(raw: string): string {
  const n = raw.toLowerCase().replace(/[\s\-_]+/g, '');
  if (['todo','notstarted','open','new','backlog'].includes(n)) return 'To Do';
  if (['inprogress','wip','active','started'].includes(n)) return 'In Progress';
  if (['reopen','reopened'].includes(n)) return 'Reopen';
  if (['readyfortest','readytotest','uat','testing'].includes(n)) return 'Ready for Test';
  if (['done','completed','finished'].includes(n)) return 'Done';
  if (['resolved','fixed'].includes(n)) return 'Resolved';
  if (['blocked','stuck'].includes(n)) return 'Blocked';
  if (['wontfix',"won'tfix",'wontdo'].includes(n)) return "Won't Fix";
  if (['duplicate'].includes(n)) return 'Duplicate';
  return raw;
}

function normalizePriority(raw: string): string {
  const n = raw.toLowerCase().trim();
  if (['highest','blocker','critical'].includes(n)) return 'Critical';
  if (['high','major'].includes(n)) return 'Major';
  if (['medium','normal','moderate'].includes(n)) return 'Medium';
  if (['low','minor','lowest','trivial'].includes(n)) return 'Minor';
  return raw;
}

function mapToActivities(issues: JiraIssue[]) {
  return issues.map(issue => {
    const f = issue.fields;
    const isEpic = f.issuetype.name.toLowerCase() === 'epic';
    const parentKey = f.parent?.key ?? f.customfield_10014 ?? '';
    return {
      jira_key:        issue.key,
      activity:        f.summary,
      no:              isEpic ? 'EPIC' : '',
      phase:           f.components?.[0]?.name ?? '',
      status:          normalizeTimelineStatus(f.status.name),
      accountable:     f.assignee?.displayName ?? '',
      sprint:          sprintName(f.customfield_10020),
      plan_end:        isoToDate(f.duedate),
      parent_jira_key: isEpic ? '' : parentKey,
    };
  });
}

function mapToBugs(issues: JiraIssue[]) {
  return issues.map(issue => {
    const f = issue.fields;
    return {
      issue_key:  issue.key,
      issue_id:   issue.id,
      issue_type: f.issuetype.name,
      summary:    f.summary,
      assignee:   f.assignee?.displayName ?? '',
      reporter:   f.reporter?.displayName ?? '',
      priority:   normalizePriority(f.priority?.name ?? 'Medium'),
      status:     normalizeBugStatus(f.status.name),
      resolution: f.resolution?.name ?? '',
      created:    isoToDate(f.created),
    };
  });
}

// ─── ChipInput ─────────────────────────────────────────────────────────────────
function ChipInput({
  values, onChange, placeholder, suggestions = [],
}: {
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
}) {
  const [input, setInput] = useState('');
  const [showSug, setShowSug] = useState(false);

  const add = useCallback((val: string) => {
    const v = val.trim();
    if (v && !values.includes(v)) onChange([...values, v]);
    setInput('');
    setShowSug(false);
  }, [values, onChange]);

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(input); }
    else if (e.key === 'Backspace' && !input && values.length) onChange(values.slice(0, -1));
  };

  const filtered = suggestions.filter(
    s => s.toLowerCase().includes(input.toLowerCase()) && !values.includes(s)
  );

  return (
    <div className="relative">
      <div className="flex flex-wrap gap-1 min-h-9 px-2 py-1.5 border rounded-md bg-background items-center focus-within:ring-1 focus-within:ring-ring">
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full font-medium">
            {v}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))}
              className="hover:text-blue-900 leading-none">
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
          value={input}
          onChange={e => { setInput(e.target.value); setShowSug(true); }}
          onKeyDown={onKeyDown}
          onFocus={() => setShowSug(true)}
          onBlur={() => setTimeout(() => setShowSug(false), 150)}
          placeholder={values.length ? '' : placeholder}
        />
      </div>
      {showSug && input && filtered.length > 0 && (
        <div className="absolute z-50 w-full mt-1 border rounded-md bg-white shadow-lg max-h-40 overflow-y-auto">
          {filtered.map(s => (
            <button key={s} type="button" onMouseDown={() => add(s)}
              className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-100">
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FilterRow helper ──────────────────────────────────────────────────────────
function FilterRow({
  label, field, onChange, placeholder, suggestions,
}: {
  label: string;
  field: FilterField;
  onChange: (f: FilterField) => void;
  placeholder: string;
  suggestions?: string[];
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-slate-700">
        {label} <span className="text-xs text-slate-400">(tuỳ chọn)</span>
      </label>
      <div className="flex gap-2">
        <div className="w-44 shrink-0">
          <Select value={field.op} onValueChange={v => onChange({ ...field, op: v as Operator })}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {OPERATORS.map(o => (
                <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <ChipInput
            values={field.values}
            onChange={v => onChange({ ...field, values: v })}
            placeholder={placeholder}
            suggestions={suggestions}
          />
        </div>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function JiraSyncDialog({
  open, onOpenChange, projectId, mode, onSynced,
}: JiraSyncDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [filter, setFilter] = useState<FilterState>({
    projectKey: '',
    labels:     { op: 'in',     values: [] },
    component:  { op: 'in',     values: [] },
    issueTypes: mode === 'bug' ? ['Bug'] : ['Epic', 'Story', 'Task', 'Bug'],
    status:     { op: 'not in', values: [] },
  });

  const [issues, setIssues]       = useState<JiraIssue[]>([]);
  const [total, setTotal]         = useState(0);
  const [page, setPage]           = useState(0);
  const PAGE = 100;

  const jql = buildJQL(filter);

  const reset = () => {
    setStep(1);
    setIssues([]);
    setTotal(0);
    setPage(0);
  };

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  const handleFetch = async (p = 0) => {
    if (!filter.projectKey.trim()) { toast.error('Vui lòng nhập Jira Project Key'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/jira/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jql, startAt: p * PAGE, maxResults: PAGE }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lỗi không xác định');
      setIssues(data.issues ?? []);
      setTotal(data.total ?? 0);
      setPage(p);
      setStep(2);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      if (mode === 'timeline') {
        const activities = mapToActivities(issues);
        const res = await fetch(`/api/projects/${projectId}/activities/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ activities }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Lỗi sync');
        toast.success(`Sync thành công: ${data.inserted} mới, ${data.updated} cập nhật`);
      } else {
        const today = new Date().toISOString().split('T')[0];
        await fetch(`/api/projects/${projectId}/bugs?date=${today}`, { method: 'DELETE' });
        const bugs = mapToBugs(issues);
        const res = await fetch(`/api/projects/${projectId}/bugs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bugs, snapshot_date: today }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? 'Lỗi sync');
        toast.success(`Sync thành công: ${bugs.length} bugs (snapshot ${today})`);
      }
      onSynced();
      handleOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  const STEP_LABELS = ['Bộ lọc JQL', 'Xem trước', 'Xác nhận'];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[94vh] flex flex-col overflow-hidden p-0">

        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <RefreshCw className="w-4 h-4 text-blue-600" />
            Sync từ Jira — {mode === 'timeline' ? 'Project Timeline' : 'Bug Tracking'}
          </DialogTitle>
          {/* Stepper */}
          <div className="flex items-center gap-1 pt-2">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const done = step > n;
              const active = step === n;
              return (
                <React.Fragment key={n}>
                  <div className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${active ? 'text-blue-600' : done ? 'text-blue-500' : 'text-slate-400'}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-all ${
                      done   ? 'bg-blue-600 text-white' :
                      active ? 'bg-blue-50 text-blue-700 border-2 border-blue-500' :
                               'bg-slate-100 text-slate-400'
                    }`}>
                      {done ? <Check className="w-3 h-3" /> : n}
                    </span>
                    {label}
                  </div>
                  {i < 2 && <div className={`flex-1 h-px mx-1 ${done ? 'bg-blue-400' : 'bg-slate-200'}`} />}
                </React.Fragment>
              );
            })}
          </div>
        </DialogHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">

          {/* ── Step 1: JQL Filter Builder ── */}
          {step === 1 && (
            <div className="space-y-5">
              {/* Project Key */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Jira Project Key <span className="text-red-500">*</span>
                </label>
                <Input
                  value={filter.projectKey}
                  onChange={e => setFilter(f => ({ ...f, projectKey: e.target.value.toUpperCase() }))}
                  placeholder="VD: MYPROJ, BACKEND, MOB..."
                  className="font-mono uppercase tracking-wider"
                />
                <p className="text-xs text-slate-400">
                  Tìm trong URL Jira: .../jira/software/projects/<strong>MYPROJ</strong>/boards
                </p>
              </div>

              <FilterRow
                label="Labels"
                field={filter.labels}
                onChange={v => setFilter(f => ({ ...f, labels: v }))}
                placeholder='Nhập label rồi Enter, VD: "v1.0", "release-2"'
              />

              <FilterRow
                label="Component"
                field={filter.component}
                onChange={v => setFilter(f => ({ ...f, component: v }))}
                placeholder='Nhập component rồi Enter, VD: "Backend", "Mobile"'
              />

              {/* Issue Type */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700">
                  Issue Type <span className="text-xs text-slate-400">(tuỳ chọn)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {ISSUE_TYPES.map(t => {
                    const selected = filter.issueTypes.includes(t);
                    return (
                      <button key={t} type="button"
                        onClick={() => setFilter(f => ({
                          ...f,
                          issueTypes: selected
                            ? f.issueTypes.filter(x => x !== t)
                            : [...f.issueTypes, t],
                        }))}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                          selected
                            ? `${TYPE_COLORS[t] ?? 'bg-gray-100 text-gray-700'} border-current`
                            : 'bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300'
                        }`}>
                        {selected && <Check className="w-3 h-3 inline mr-1" />}
                        {t}
                      </button>
                    );
                  })}
                  {filter.issueTypes.length > 0 && (
                    <button type="button"
                      onClick={() => setFilter(f => ({ ...f, issueTypes: [] }))}
                      className="text-xs text-slate-400 hover:text-slate-600 underline px-1">
                      Bỏ chọn tất cả
                    </button>
                  )}
                </div>
              </div>

              <FilterRow
                label="Status"
                field={filter.status}
                onChange={v => setFilter(f => ({ ...f, status: v }))}
                placeholder='Nhập status rồi Enter hoặc chọn từ gợi ý'
                suggestions={COMMON_STATUSES}
              />

              {/* JQL Preview */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-slate-700 flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-500" /> JQL được tạo tự động
                </label>
                <div className="bg-slate-900 text-green-300 font-mono text-xs px-4 py-3 rounded-lg leading-relaxed break-all min-h-[52px]">
                  {jql || <span className="text-slate-600 italic">Nhập Project Key để xem JQL...</span>}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 2: Preview Results ── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-slate-600">
                  Tìm thấy <span className="font-semibold text-blue-600">{total}</span> issues
                  {total > PAGE && <span className="text-amber-600 ml-1 text-xs">(hiển thị {PAGE}/lần, cần dùng filter hẹp hơn)</span>}
                </p>
                <code className="text-[11px] text-slate-400 truncate max-w-xs font-mono">{jql}</code>
              </div>

              {issues.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Không tìm thấy issue nào với bộ lọc này</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b text-slate-600 font-medium">
                        <th className="text-left px-3 py-2 w-24">Key</th>
                        <th className="text-left px-3 py-2 w-[90px]">Type</th>
                        <th className="text-left px-3 py-2">Summary</th>
                        <th className="text-left px-3 py-2 w-28">Status</th>
                        <th className="text-left px-3 py-2 w-28">Assignee</th>
                        <th className="text-left px-3 py-2 w-20">Priority</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {issues.map(issue => (
                        <tr key={issue.key} className="hover:bg-slate-50/70">
                          <td className="px-3 py-2 font-mono text-blue-600 font-medium">{issue.key}</td>
                          <td className="px-3 py-2">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${TYPE_COLORS[issue.fields.issuetype.name] ?? 'bg-gray-100 text-gray-600'}`}>
                              {issue.fields.issuetype.name}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-slate-700 max-w-0">
                            <div className="truncate" title={issue.fields.summary}>{issue.fields.summary}</div>
                          </td>
                          <td className="px-3 py-2 text-slate-500">{issue.fields.status.name}</td>
                          <td className="px-3 py-2 text-slate-500 truncate">{issue.fields.assignee?.displayName ?? '—'}</td>
                          <td className="px-3 py-2 text-slate-500">{issue.fields.priority?.name ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Pagination for browsing (sync only does current page) */}
              {total > PAGE && (
                <div className="flex items-center justify-between">
                  <Button variant="outline" size="sm" disabled={page === 0 || loading}
                    onClick={() => handleFetch(page - 1)}>
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronLeft className="w-3 h-3" />}
                    Trang trước
                  </Button>
                  <span className="text-xs text-slate-500">Trang {page + 1} / {Math.ceil(total / PAGE)}</span>
                  <Button variant="outline" size="sm" disabled={(page + 1) * PAGE >= total || loading}
                    onClick={() => handleFetch(page + 1)}>
                    Trang sau
                    {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
                <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Xác nhận sync {issues.length} issues
                </h3>
                <div className="text-sm text-blue-700 space-y-1.5">
                  <p>• <strong>Nguồn:</strong> Jira project <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono">{filter.projectKey}</code></p>
                  <p>• <strong>Tổng tìm thấy:</strong> {total} issues / sync trang này: <strong>{issues.length} issues</strong></p>
                  <p>• <strong>Đích:</strong> {
                    mode === 'timeline'
                      ? 'Project Timeline — upsert theo Jira Key (thêm mới nếu chưa có, cập nhật nếu đã có)'
                      : `Bug Tracking — snapshot ngày ${new Date().toLocaleDateString('vi-VN', { year:'numeric',month:'2-digit',day:'2-digit' })}`
                  }</p>
                </div>
              </div>

              {mode === 'bug' && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-sm text-amber-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Dữ liệu bug của <strong>ngày hôm nay</strong> sẽ bị <strong>xoá và thay thế</strong> hoàn toàn bằng dữ liệu Jira.</span>
                </div>
              )}

              {mode === 'timeline' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex gap-2 text-sm text-green-700">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>Issue đã có trong Timeline (cùng Jira Key) sẽ được <strong>cập nhật</strong>. Issue mới sẽ được <strong>thêm vào cuối</strong>.</span>
                </div>
              )}

              {total > PAGE && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-xs text-amber-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Jira có <strong>{total} issues</strong> nhưng sẽ chỉ sync <strong>{issues.length} issues</strong> của trang {page + 1}.
                    Hãy dùng bộ lọc hẹp hơn (thêm Labels, Component hoặc Status) để giảm số lượng.
                  </span>
                </div>
              )}

              <div className="bg-slate-50 rounded-lg px-4 py-3">
                <p className="text-xs text-slate-500 font-medium mb-1.5">JQL đã dùng:</p>
                <code className="text-xs text-slate-600 break-all leading-relaxed">{jql}</code>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t shrink-0 flex items-center justify-between">
          <div>
            {step > 1 && (
              <Button variant="outline" onClick={() => setStep(s => (s - 1) as 1 | 2 | 3)}
                disabled={loading || syncing}>
                <ChevronLeft className="w-4 h-4 mr-1" /> Quay lại
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={syncing}>
              Huỷ
            </Button>
            {step === 1 && (
              <Button onClick={() => handleFetch(0)} disabled={loading || !filter.projectKey.trim()}>
                {loading
                  ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Đang tải...</>
                  : <><Search className="w-4 h-4 mr-1" />Fetch từ Jira</>
                }
              </Button>
            )}
            {step === 2 && (
              <Button onClick={() => setStep(3)} disabled={issues.length === 0}>
                Tiến hành Sync <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            )}
            {step === 3 && (
              <Button onClick={handleSync} disabled={syncing}
                className="bg-blue-600 hover:bg-blue-700 text-white">
                {syncing
                  ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Đang sync...</>
                  : <><RefreshCw className="w-4 h-4 mr-1" />Xác nhận Sync</>
                }
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
