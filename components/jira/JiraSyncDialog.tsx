'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  RefreshCw, ChevronRight, ChevronLeft, Loader2,
  AlertCircle, CheckCircle2, Database, Check,
  Save, Trash2, BookOpen,
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────────
interface JiraSyncDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  mode: 'timeline' | 'bug';
  onSynced: () => void;
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
    customfield_10014?: string;
    customfield_10016?: number;
    customfield_10020?: Array<{ name: string; state: string }> | string;
    customfield_1185?: { id?: string; value: string } | null;
    resolution?: { name: string } | null;
    created: string;
    duedate?: string | null;
  };
}

interface JqlPreset {
  id: number;
  name: string;
  jql: string;
  created_at: string;
}

// ─── Constants ─────────────────────────────────────────────────────────────────
const TYPE_COLORS: Record<string, string> = {
  Epic:       'bg-purple-100 text-purple-700',
  Story:      'bg-green-100 text-green-700',
  Task:       'bg-blue-100 text-blue-700',
  Bug:        'bg-red-100 text-red-700',
  'Sub-task': 'bg-orange-100 text-orange-700',
};

// ─── Field Mapping helpers ─────────────────────────────────────────────────────
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
      severity:   f.customfield_1185?.value ?? '',
      status:     normalizeBugStatus(f.status.name),
      resolution: f.resolution?.name ?? '',
      created:    isoToDate(f.created),
    };
  });
}

// ─── Main component ────────────────────────────────────────────────────────────
export default function JiraSyncDialog({
  open, onOpenChange, projectId, mode, onSynced,
}: JiraSyncDialogProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [jql, setJql] = useState('');
  const [presets, setPresets] = useState<JqlPreset[]>([]);
  const [presetName, setPresetName] = useState('');
  const [savingPreset, setSavingPreset] = useState(false);

  const [issues, setIssues]               = useState<JiraIssue[]>([]);
  const [total, setTotal]                 = useState(0);
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const PAGE = 100;

  const reset = useCallback(() => {
    setStep(1);
    setIssues([]);
    setTotal(0);
    setNextPageToken(null);
  }, []);

  const handleOpenChange = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  useEffect(() => {
    if (open) {
      fetch('/api/jira/jql-presets').then(r => r.json()).then(setPresets).catch(() => {});
    }
  }, [open]);

  const handleSavePreset = async () => {
    if (!presetName.trim()) { toast.error('Nhập tên để lưu'); return; }
    if (!jql.trim()) { toast.error('JQL không được để trống'); return; }
    setSavingPreset(true);
    try {
      const res = await fetch('/api/jira/jql-presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: presetName.trim(), jql: jql.trim() }),
      });
      const saved = await res.json();
      setPresets(p => [saved, ...p.slice(0, 9)]);
      setPresetName('');
      toast.success(`Đã lưu JQL "${saved.name}"`);
    } catch { toast.error('Lưu thất bại'); }
    setSavingPreset(false);
  };

  const handleDeletePreset = async (id: number) => {
    await fetch(`/api/jira/jql-presets/${id}`, { method: 'DELETE' });
    setPresets(p => p.filter(x => x.id !== id));
    toast.success('Đã xóa preset');
  };

  const handleFetch = async () => {
    if (!jql.trim()) { toast.error('Vui lòng nhập JQL'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/jira/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jql: jql.trim(), maxResults: PAGE }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lỗi không xác định');
      setIssues(data.issues ?? []);
      setTotal(data.total ?? (data.issues?.length ?? 0));
      setNextPageToken(data.nextPageToken ?? null);
      setStep(2);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleFetchMore = async () => {
    if (!nextPageToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/jira/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jql: jql.trim(), maxResults: PAGE, nextPageToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Lỗi không xác định');
      setIssues(prev => [...prev, ...(data.issues ?? [])]);
      setNextPageToken(data.nextPageToken ?? null);
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

  const STEP_LABELS = ['Câu JQL', 'Xem trước', 'Xác nhận'];

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[94vh] flex flex-col overflow-hidden p-0">

        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-3 shrink-0 border-b">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <RefreshCw className="w-4 h-4 text-blue-600" />
            Sync từ Jira — {mode === 'timeline' ? 'Project Timeline' : 'Bug Tracking'}
          </DialogTitle>
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

          {/* ── Step 1: JQL Input ── */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Câu JQL <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={jql}
                  onChange={e => setJql(e.target.value)}
                  rows={5}
                  className="w-full font-mono text-sm border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-slate-50 leading-relaxed"
                  placeholder={
                    mode === 'bug'
                      ? 'project = "MYPROJ" AND issuetype = Bug AND status != Done ORDER BY created ASC'
                      : 'project = "MYPROJ" AND issuetype in (Epic, Story, Task) ORDER BY created ASC'
                  }
                />
                <p className="text-xs text-slate-400">
                  Nhập câu JQL trực tiếp. Ví dụ: <code className="bg-slate-100 px-1 rounded">project = "ABC" AND issuetype = Bug AND sprint in openSprints()</code>
                </p>
              </div>

              {/* Save preset */}
              <div className="flex items-center gap-2">
                <Input
                  className="h-8 text-xs flex-1"
                  placeholder="Đặt tên để lưu JQL này..."
                  value={presetName}
                  onChange={e => setPresetName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSavePreset(); }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs shrink-0"
                  disabled={savingPreset || !presetName.trim() || !jql.trim()}
                  onClick={handleSavePreset}
                >
                  <Save className="w-3.5 h-3.5" />
                  {savingPreset ? 'Đang lưu...' : 'Lưu JQL'}
                </Button>
              </div>

              {/* Saved presets */}
              {presets.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                    <BookOpen className="w-3.5 h-3.5" />
                    JQL đã lưu ({presets.length}/10)
                  </div>
                  <div className="space-y-1.5">
                    {presets.map(p => (
                      <div key={p.id} className="flex items-start gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 group hover:border-blue-300 hover:bg-blue-50/40 transition-colors">
                        <button
                          className="flex-1 text-left min-w-0"
                          onClick={() => { setJql(p.jql); toast.success(`Đã tải "${p.name}"`); }}
                        >
                          <p className="text-xs font-semibold text-blue-700 group-hover:text-blue-800">{p.name}</p>
                          <p className="text-[11px] text-slate-400 font-mono truncate mt-0.5">{p.jql}</p>
                        </button>
                        <button
                          onClick={() => handleDeletePreset(p.id)}
                          className="shrink-0 text-slate-300 hover:text-red-500 transition-colors mt-0.5"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 2: Preview Results ── */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <p className="text-sm text-slate-600">
                  Tìm thấy <span className="font-semibold text-blue-600">{total}</span> issues
                  {total > PAGE && <span className="text-amber-600 ml-1 text-xs">(tải {PAGE}/lần)</span>}
                </p>
                <code className="text-[11px] text-slate-400 truncate max-w-xs font-mono">{jql}</code>
              </div>

              {issues.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">Không tìm thấy issue nào với JQL này</p>
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
                        <th className="text-left px-3 py-2 w-20">Severity</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {issues.map(issue => {
                        const severity = issue.fields.customfield_1185?.value ?? '';
                        const SEVERITY_BADGE: Record<string, string> = {
                          Blocker:  'bg-purple-100 text-purple-700',
                          Critical: 'bg-red-100 text-red-700',
                          Highest:  'bg-red-100 text-red-700',
                          Major:    'bg-orange-100 text-orange-700',
                          High:     'bg-orange-100 text-orange-700',
                          Medium:   'bg-yellow-100 text-yellow-700',
                          Normal:   'bg-yellow-100 text-yellow-700',
                          Low:      'bg-green-100 text-green-700',
                          Minor:    'bg-blue-100 text-blue-700',
                          Trivial:  'bg-slate-100 text-slate-500',
                          Lowest:   'bg-slate-100 text-slate-500',
                        };
                        return (
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
                          <td className="px-3 py-2">
                            {severity
                              ? <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${SEVERITY_BADGE[severity] ?? 'bg-slate-100 text-slate-600'}`}>{severity}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {nextPageToken && (
                <div className="flex justify-center pt-1">
                  <Button variant="outline" size="sm" onClick={handleFetchMore} disabled={loading}
                    className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50">
                    {loading
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Đang tải...</>
                      : <><ChevronRight className="w-3 h-3" /> Tải thêm {total > issues.length ? `(còn ${total - issues.length})` : ''}</>
                    }
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
                  <p>• <strong>Tổng tìm thấy:</strong> {total} issues / đã tải: <strong>{issues.length} issues</strong>{nextPageToken ? ' (còn issues chưa tải — nhấn "Tải thêm" ở bước trước)' : ' ✓ đầy đủ'}</p>
                  <p>• <strong>Đích:</strong> {
                    mode === 'timeline'
                      ? 'Project Timeline — upsert theo Jira Key'
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

              {nextPageToken && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2 text-xs text-amber-700">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    Chưa tải hết — Jira có <strong>{total} issues</strong>, đã tải <strong>{issues.length}</strong>.
                    Quay lại bước trước và nhấn <strong>&ldquo;Tải thêm&rdquo;</strong> để lấy phần còn lại trước khi sync.
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
              <Button onClick={handleFetch} disabled={loading || !jql.trim()}>
                {loading
                  ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" />Đang tải...</>
                  : <><RefreshCw className="w-4 h-4 mr-1" />Fetch từ Jira</>
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
