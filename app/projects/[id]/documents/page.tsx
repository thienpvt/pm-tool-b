'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { FileText, Download, Pencil, Presentation, Plus, Trash2, CalendarRange, ExternalLink } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type DocRecord = {
  id: number;
  type: string;
  title: string;
  content_json: string;
  created_at: string;
  updated_at: string;
};

type DocDef = {
  type: string;
  label: string;
  desc: string;
  fields: { key: string; label: string; multiline?: boolean }[];
};

// ─── Static doc definitions (non-weekly) ─────────────────────────────────────

const DOC_TYPES: DocDef[] = [
  {
    type: 'project_charter',
    label: 'Project Charter',
    desc: 'Tài liệu khởi tạo project: mục tiêu, scope, stakeholders',
    fields: [
      { key: 'objectives', label: 'Project Objectives', multiline: true },
      { key: 'scope', label: 'Project Scope', multiline: true },
      { key: 'out_of_scope', label: 'Out of Scope', multiline: true },
      { key: 'key_stakeholders', label: 'Key Stakeholders', multiline: true },
      { key: 'budget', label: 'Budget / Investment' },
      { key: 'success_criteria', label: 'Success Criteria', multiline: true },
      { key: 'assumptions', label: 'Assumptions & Constraints', multiline: true },
    ],
  },
  {
    type: 'sow',
    label: 'Statement of Work (SoW)',
    desc: 'Định nghĩa phạm vi, timeline và deliverables chính thức',
    fields: [
      { key: 'project_overview', label: 'Project Overview', multiline: true },
      { key: 'solution_proposal', label: 'Solution Proposal', multiline: true },
      { key: 'methodology', label: 'Implementation Methodology', multiline: true },
      { key: 'milestones', label: 'High-Level Milestones', multiline: true },
      { key: 'payment_terms', label: 'Payment Terms / Commercial Terms', multiline: true },
      { key: 'dependencies', label: 'Assumptions & Dependencies', multiline: true },
    ],
  },
  {
    type: 'pmp',
    label: 'Project Management Plan (PMP)',
    desc: 'Kế hoạch quản lý dự án tổng hợp',
    fields: [
      { key: 'change_management', label: 'Change Management Process', multiline: true },
      { key: 'quality_plan', label: 'Quality Assurance Plan', multiline: true },
      { key: 'rollout_strategy', label: 'Rollout & Data Migration Strategy', multiline: true },
      { key: 'governance', label: 'Project Governance', multiline: true },
    ],
  },
  {
    type: 'change_request',
    label: 'Change Request',
    desc: 'Yêu cầu thay đổi scope / timeline / resource',
    fields: [
      { key: 'cr_id', label: 'CR ID' },
      { key: 'cr_title', label: 'Change Title' },
      { key: 'description', label: 'Description of Change', multiline: true },
      { key: 'justification', label: 'Justification / Business Need', multiline: true },
      { key: 'impact_scope', label: 'Impact on Scope', multiline: true },
      { key: 'impact_timeline', label: 'Impact on Timeline' },
      { key: 'impact_budget', label: 'Impact on Budget' },
      { key: 'recommendation', label: 'Recommendation', multiline: true },
    ],
  },
  {
    type: 'closure_report',
    label: 'Project Closure Report',
    desc: 'Báo cáo tổng kết và đóng project',
    fields: [
      { key: 'executive_summary', label: 'Executive Summary', multiline: true },
      { key: 'objectives_achieved', label: 'Objectives Achieved vs Planned', multiline: true },
      { key: 'key_achievements', label: 'Key Achievements', multiline: true },
      { key: 'lessons_learned', label: 'Lessons Learned', multiline: true },
      { key: 'benefit_validation', label: 'Benefit & Criteria Validation', multiline: true },
      { key: 'recommendations', label: 'Recommendations for Future', multiline: true },
    ],
  },
];

const WEEKLY_FIELDS = [
  { key: 'overall_status', label: 'Overall Status (RAG: Red / Amber / Green)' },
  { key: 'completed_this_week', label: 'Completed This Week', multiline: true },
  { key: 'plan_next_week', label: 'Plan Next Week', multiline: true },
  { key: 'risks_issues', label: 'Key Risks & Issues', multiline: true },
  { key: 'decisions_needed', label: 'Decisions Needed', multiline: true },
];

const PPT_FIELDS = [
  { key: 'presentation_date', label: 'Presentation Date', multiline: false },
  { key: 'methodology', label: 'Implementation Methodology (slide 5)', multiline: true },
  { key: 'next_steps', label: 'Next Steps & Action Items (slide 9)', multiline: true },
  { key: 'agenda', label: 'Custom Agenda (one item per line, leave blank for default)', multiline: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toYYMMDD(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const yy = String(d.getFullYear()).slice(2);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function parseWeeklyTitle(title: string): { from: string; to: string } | null {
  // Format: ProjectName_Weekly Report_YYMMDD_YYMMDD
  const parts = title.split('_Weekly Report_');
  if (parts.length < 2) return null;
  const dates = parts[1].split('_');
  if (dates.length < 2) return null;
  const parse = (s: string) => {
    if (s.length !== 6) return '';
    return `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
  };
  return { from: parse(dates[0]), to: parse(dates[1]) };
}

function statusRagColor(rag: string) {
  const r = (rag || '').toLowerCase();
  if (r.includes('red') || r === 'r') return 'bg-red-100 text-red-700 border-red-200';
  if (r.includes('amber') || r === 'a') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (r.includes('green') || r === 'g') return 'bg-green-100 text-green-700 border-green-200';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const { id } = useParams<{ id: string }>();
  const [docs, setDocs] = useState<Record<string, Record<string, string>>>({});
  const [weeklyReports, setWeeklyReports] = useState<DocRecord[]>([]);
  const [projectName, setProjectName] = useState('');
  const [editing, setEditing] = useState<DocDef | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  // PPT dialog state
  const [pptOpen, setPptOpen] = useState(false);
  const [pptForm, setPptForm] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    const [data, proj] = await Promise.all([
      fetch(`/api/projects/${id}/documents`).then(r => r.json()) as Promise<DocRecord[]>,
      fetch(`/api/projects/${id}`).then(r => r.json()),
    ]);
    setProjectName(proj.name ?? '');

    const map: Record<string, Record<string, string>> = {};
    const weekly: DocRecord[] = [];
    for (const d of data) {
      if (d.type === 'status_report') {
        weekly.push(d);
      } else {
        map[d.type] = JSON.parse(d.content_json || '{}');
      }
    }
    setDocs(map);
    // Sort weekly reports newest first using title dates
    setWeeklyReports(weekly.sort((a, b) => b.title.localeCompare(a.title)));
    if (map['kickoff_ppt']) setPptForm(map['kickoff_ppt']);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // ── Static doc handlers ───────────────────────────────────────────────────

  const openEdit = (def: DocDef) => {
    setEditing(def);
    setForm(docs[def.type] ?? {});
  };

  const saveDoc = async () => {
    if (!editing) return;
    setSaving(true);
    await fetch(`/api/projects/${id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: editing.type, title: editing.label, content: form }),
    });
    setDocs(d => ({ ...d, [editing.type]: form }));
    setSaving(false);
    setEditing(null);
    toast.success('Document saved!');
  };

  const downloadDoc = async (type: string, label: string) => {
    setDownloading(type);
    try {
      const res = await fetch(`/api/export/word/${id}/${type}`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `${label.replace(/\s+/g, '-')}.docx`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`${label} downloaded!`);
    } catch (e) { toast.error(String(e)); }
    finally { setDownloading(null); }
  };

  // ── PPT handlers ──────────────────────────────────────────────────────────

  const savePptConfig = async () => {
    await fetch(`/api/projects/${id}/documents`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'kickoff_ppt', title: 'Kick-off Presentation Config', content: pptForm }),
    });
    setDocs(d => ({ ...d, kickoff_ppt: pptForm }));
  };

  const downloadPPT = async () => {
    setDownloading('kickoff_ppt');
    await savePptConfig();
    try {
      const res = await fetch(`/api/export/ppt/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pptForm),
      });
      if (!res.ok) throw new Error('PPT export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'kickoff-presentation.pptx'; a.click();
      URL.revokeObjectURL(url);
      toast.success('Kick-off Presentation downloaded!');
      setPptOpen(false);
    } catch (e) { toast.error(String(e)); }
    finally { setDownloading(null); }
  };

  // ── Weekly report handlers ────────────────────────────────────────────────

  const deleteWeekly = async (docId: number, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    await fetch(`/api/projects/${id}/documents?docId=${docId}`, { method: 'DELETE' });
    setWeeklyReports(r => r.filter(d => d.id !== docId));
    toast.success('Report deleted');
  };

  const downloadWeekly = (doc: DocRecord) => {
    const content = JSON.parse(doc.content_json || '{}') as Record<string, string>;
    const reportText = content.report_text
      || WEEKLY_FIELDS.map(f => `${f.label}:\n${content[f.key] || '—'}`).join('\n\n');
    const text = [doc.title, '='.repeat(60), '', reportText].join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${doc.title}.txt`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Downloaded as text');
  };

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar projectId={id} />
      <main className="flex-1 p-4 lg:p-6">

        {/* ── Kick-off PPT ───────────────────────────────────────────────── */}
        <div className="mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Presentation</h2>
          <Card className="p-5 flex flex-col gap-3 border-blue-200 bg-blue-50/40 max-w-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                <Presentation className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-slate-800">Kick-off Presentation</h3>
                <p className="text-xs text-slate-400 mt-0.5">10-slide PPT — project overview, team, timeline, risks</p>
              </div>
            </div>
            {docs['kickoff_ppt'] && (
              <div className="text-xs text-green-600 bg-green-50 rounded px-2 py-1">✓ Config saved</div>
            )}
            <div className="flex gap-2 mt-auto">
              <Button size="sm" variant="outline" onClick={() => setPptOpen(true)} className="gap-1.5 flex-1">
                <Pencil className="h-3 w-3" /> Configure
              </Button>
              <Button
                size="sm"
                disabled={downloading === 'kickoff_ppt'}
                onClick={() => setPptOpen(true)}
                className="gap-1.5 bg-blue-600 hover:bg-blue-700 flex-1"
              >
                <Download className="h-3 w-3" />
                {downloading === 'kickoff_ppt' ? 'Generating...' : 'Generate PPT'}
              </Button>
            </div>
          </Card>
        </div>

        {/* ── Weekly Reports ─────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Weekly Status Reports</h2>
              <p className="text-xs text-slate-400 mt-0.5">{weeklyReports.length} report{weeklyReports.length !== 1 ? 's' : ''}</p>
            </div>
            <Link href={`/projects/${id}/reports`}>
              <Button className="bg-blue-600 hover:bg-blue-700 gap-2 h-8 text-xs">
                <Plus className="h-3.5 w-3.5" /> New Report
              </Button>
            </Link>
          </div>

          {weeklyReports.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center">
              <CalendarRange className="h-7 w-7 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-400">No weekly reports yet</p>
              <Link href={`/projects/${id}/reports`} className="text-xs text-blue-500 hover:underline mt-1 inline-block">Go to Reports page to create one →</Link>
            </div>
          ) : (
            <div className="rounded-xl border bg-white overflow-hidden shadow-sm divide-y">
              {weeklyReports.map(doc => {
                const content = JSON.parse(doc.content_json || '{}') as Record<string, string>;
                const dates = parseWeeklyTitle(doc.title);
                const rag = content.overall_status ?? '';
                const pct = content.completion_pct ? Number(content.completion_pct) : undefined;
                return (
                  <div key={doc.id} className="flex items-center gap-4 px-4 py-3 hover:bg-slate-50 transition-colors">
                    {/* Date block */}
                    <div className="w-28 shrink-0">
                      {dates ? (
                        <>
                          <p className="text-[11px] font-mono text-slate-700 font-medium">{formatDisplayDate(dates.from)}</p>
                          <p className="text-[10px] text-slate-400">→ {formatDisplayDate(dates.to)}</p>
                        </>
                      ) : (
                        <p className="text-[11px] text-slate-400">—</p>
                      )}
                    </div>

                    {/* Progress */}
                    {pct !== undefined && (
                      <div className="w-16 shrink-0">
                        <p className="text-[10px] text-slate-500 font-medium">{pct}%</p>
                        <div className="h-1 bg-slate-100 rounded-full mt-1">
                          <div className={`h-full rounded-full ${pct >= 70 ? 'bg-green-400' : pct >= 40 ? 'bg-blue-400' : 'bg-amber-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}

                    {/* Title snippet */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{doc.title}</p>
                      {content.report_text && (
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{content.report_text.slice(0, 80)}…</p>
                      )}
                    </div>

                    {/* RAG badge */}
                    {rag && (
                      <span className={`text-[10px] px-2 py-0.5 rounded border font-medium shrink-0 ${statusRagColor(rag)}`}>
                        {rag}
                      </span>
                    )}

                    {/* Actions */}
                    <div className="flex gap-1.5 shrink-0">
                      <Link href={`/projects/${id}/reports`}>
                        <Button size="sm" variant="outline" className="h-7 px-2.5 text-xs gap-1">
                          <ExternalLink className="h-3 w-3" /> Open
                        </Button>
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadWeekly(doc)}
                        className="h-7 px-2.5 text-xs gap-1"
                      >
                        <Download className="h-3 w-3" /> .txt
                      </Button>
                      <button
                        onClick={() => deleteWeekly(doc.id, doc.title)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Word Documents ─────────────────────────────────────────────── */}
        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">Word Documents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {DOC_TYPES.map(def => {
            const filled = !!docs[def.type];
            return (
              <Card key={def.type} className="p-5 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm text-slate-800">{def.label}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{def.desc}</p>
                  </div>
                </div>
                {filled && (
                  <div className="text-xs text-green-600 bg-green-50 rounded px-2 py-1">✓ Content saved</div>
                )}
                <div className="flex gap-2 mt-auto">
                  <Button size="sm" variant="outline" onClick={() => openEdit(def)} className="gap-1.5 flex-1">
                    <Pencil className="h-3 w-3" />
                    {filled ? 'Edit' : 'Fill Content'}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!filled || downloading === def.type}
                    onClick={() => downloadDoc(def.type, def.label)}
                    className="gap-1.5 bg-blue-600 hover:bg-blue-700 flex-1"
                  >
                    <Download className="h-3 w-3" />
                    {downloading === def.type ? '...' : 'Download'}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </main>

      {/* ── PPT Config Dialog ──────────────────────────────────────────────── */}
      <Dialog open={pptOpen} onOpenChange={o => !o && setPptOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Kick-off Presentation (10 slides)</DialogTitle>
          </DialogHeader>
          <p className="text-xs text-slate-400 -mt-2">
            Team, schedule, risks, and communication plan are pulled automatically from project data. Fill optional fields below to customize.
          </p>
          <div className="space-y-4 py-2">
            {PPT_FIELDS.map(f => (
              <div key={f.key}>
                <Label htmlFor={f.key} className="text-sm">{f.label}</Label>
                {f.multiline ? (
                  <Textarea id={f.key} className="mt-1.5 text-sm" rows={4} value={pptForm[f.key] ?? ''} onChange={e => setPptForm(x => ({ ...x, [f.key]: e.target.value }))} />
                ) : (
                  <Input id={f.key} className="mt-1.5 text-sm" value={pptForm[f.key] ?? ''} onChange={e => setPptForm(x => ({ ...x, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPptOpen(false)}>Cancel</Button>
            <Button variant="outline" onClick={async () => { await savePptConfig(); toast.success('Config saved'); }}>
              Save Config
            </Button>
            <Button onClick={downloadPPT} disabled={downloading === 'kickoff_ppt'} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Download className="h-4 w-4" />
              {downloading === 'kickoff_ppt' ? 'Generating...' : 'Generate & Download'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Static Doc Edit Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!editing} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing?.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editing?.fields.map(f => (
              <div key={f.key}>
                <Label htmlFor={f.key} className="text-sm">{f.label}</Label>
                {f.multiline ? (
                  <Textarea id={f.key} className="mt-1.5 text-sm" rows={3} value={form[f.key] ?? ''} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} />
                ) : (
                  <Input id={f.key} className="mt-1.5 text-sm" value={form[f.key] ?? ''} onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveDoc} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
