'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Sparkles, Download, RefreshCw, Calendar, CheckCircle2, Clock,
  ChevronRight, ShieldAlert, Bug, TrendingUp, FileText, AlertCircle,
  Eye, KeyRound, Copy, Plus, Trash2, Save,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────
type DocRecord = { id: number; type: string; title: string; content_json: string; created_at: string; updated_at: string; };
type Activity = { id: number; activity: string; deliverable: string; completion_pct: number; plan_start: string; plan_end: string; actual_end: string; status: string; };
type RiskIssue = { id: number; description: string; priority: string; status: string; mitigation: string; };
type EpicStat = { phase: string; total: number; done: number; pct: number };
type ReportData = {
  project: { name: string; program_name: string; client: string; current_phase: string; pm_name: string; };
  weekRange: { start: string; end: string };
  doneThisWeek: Activity[];
  inProgress: Activity[];
  nextWeekPlan: Activity[];
  openRisks: RiskIssue[];
  openIssues: RiskIssue[];
  stats: { total: number; done: number; inProgress: number; notStarted: number; completion_pct: number };
  epicStats: EpicStat[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getThisMonday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  return d.toISOString().split('T')[0];
}
function getThisSunday() {
  const d = new Date();
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1) + 6);
  return d.toISOString().split('T')[0];
}
function fmtDate(s: string) {
  if (!s) return '';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
function fmtDateLong(s: string) {
  if (!s) return '';
  return new Date(s + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}
function formatDisplayDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function toYYMMDD(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
function buildReportTitle(projectName: string, from: string, to: string): string {
  return `${projectName}_Weekly Report_${toYYMMDD(from)}_${toYYMMDD(to)}`;
}
function parseWeeklyTitle(title: string): { from: string; to: string } | null {
  const parts = title.split('_Weekly Report_');
  if (parts.length < 2) return null;
  const dates = parts[1].split('_');
  if (dates.length < 2) return null;
  const parse = (s: string) => s.length !== 6 ? '' : `20${s.slice(0, 2)}-${s.slice(2, 4)}-${s.slice(4, 6)}`;
  return { from: parse(dates[0]), to: parse(dates[1]) };
}
const PRIORITY_DOT: Record<string, string> = {
  Critical: 'bg-red-500', High: 'bg-orange-400', Medium: 'bg-yellow-400', Low: 'bg-slate-300',
};
function PriorityDot({ p }: { p: string }) {
  return <span className={`inline-block w-2 h-2 rounded-full mr-1 ${PRIORITY_DOT[p] ?? 'bg-slate-300'}`} />;
}
function healthStatus(pct: number): { label: string; cls: string } {
  if (pct >= 70) return { label: '● GREEN', cls: 'text-green-600 bg-green-50 border-green-200' };
  if (pct >= 40) return { label: '● AMBER', cls: 'text-amber-600 bg-amber-50 border-amber-200' };
  return { label: '● RED', cls: 'text-red-600 bg-red-50 border-red-200' };
}

// ─── Manual report builder ────────────────────────────────────────────────────
function buildManualReport(data: ReportData, language: string, startDate: string, endDate: string): string {
  const { project, doneThisWeek, inProgress, nextWeekPlan, openRisks, openIssues, stats, epicStats } = data;
  const isVN = language === 'Vietnamese';
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const health = stats.completion_pct >= 70 ? (isVN ? 'XANH ✓' : 'GREEN ✓')
    : stats.completion_pct >= 40 ? (isVN ? 'VÀNG ⚠' : 'AMBER ⚠')
    : (isVN ? 'ĐỎ ✗' : 'RED ✗');

  const lines: string[] = [];
  if (isVN) {
    lines.push('BÁO CÁO TIẾN ĐỘ DỰ ÁN HÀNG TUẦN');
    lines.push('═══════════════════════════════════════');
    lines.push(`Dự án     : ${project.name}`);
    lines.push(`Chương trình: ${project.program_name || project.client || 'N/A'}`);
    lines.push(`Phase     : ${project.current_phase}`);
    lines.push(`Kỳ báo cáo: ${fmtDateLong(startDate)} – ${fmtDateLong(endDate)}`);
    lines.push(`Ngày tạo  : ${today}`);
    lines.push(`PM        : ${project.pm_name || 'N/A'}`);
    lines.push('═══════════════════════════════════════');
    lines.push('');
    lines.push(`📊 TỔNG TIẾN ĐỘ: ${stats.completion_pct}% (Hoàn thành: ${stats.done} | Đang làm: ${stats.inProgress} | Chưa làm: ${stats.notStarted} | Tổng: ${stats.total} US)`);
    lines.push(`🚦 TÌNH TRẠNG: ${health}`);
    if (epicStats?.length > 0) {
      lines.push('');
      lines.push('───────────────────────────────────────');
      lines.push('📁 TIẾN ĐỘ THEO EPIC');
      lines.push('───────────────────────────────────────');
      epicStats.forEach(e => {
        const bar = '█'.repeat(Math.round(e.pct / 10)) + '░'.repeat(10 - Math.round(e.pct / 10));
        lines.push(`   ${e.phase}`);
        lines.push(`   [${bar}] ${e.pct}%  (${e.done}/${e.total} US hoàn thành)`);
      });
    }
    lines.push('');
    lines.push('───────────────────────────────────────');
    lines.push(`✅ HOÀN THÀNH TRONG KỲ (${doneThisWeek.length})`);
    lines.push('───────────────────────────────────────');
    if (doneThisWeek.length === 0) {
      lines.push('   – Không có công việc hoàn thành trong kỳ.');
    } else {
      doneThisWeek.forEach(a => {
        lines.push(`   ✓ ${a.activity}${a.deliverable ? `\n     → Sản phẩm: ${a.deliverable}` : ''}`);
      });
    }
    lines.push('');
    lines.push('───────────────────────────────────────');
    lines.push(`🔄 ĐANG THỰC HIỆN (${inProgress.length})`);
    lines.push('───────────────────────────────────────');
    if (inProgress.length === 0) {
      lines.push('   – Không có công việc đang thực hiện.');
    } else {
      inProgress.forEach(a => {
        lines.push(`   • ${a.activity} — ${a.completion_pct}%${a.plan_end ? ` (hạn: ${fmtDate(a.plan_end)})` : ''}`);
      });
    }
    lines.push('');
    lines.push('───────────────────────────────────────');
    lines.push(`📋 KẾ HOẠCH TIẾP THEO (${nextWeekPlan.length})`);
    lines.push('───────────────────────────────────────');
    if (nextWeekPlan.length === 0) {
      lines.push('   – Chưa có kế hoạch cụ thể cho kỳ tới.');
    } else {
      nextWeekPlan.forEach(a => {
        lines.push(`   → ${a.activity}${a.plan_start ? ` (bắt đầu: ${fmtDate(a.plan_start)})` : ''}`);
      });
    }
    if (openRisks.length > 0 || openIssues.length > 0) {
      lines.push('');
      lines.push('───────────────────────────────────────');
      lines.push(`⚠ RỦI RO & VẤN ĐỀ`);
      lines.push('───────────────────────────────────────');
      openRisks.forEach(r => {
        lines.push(`   🛡 [${r.priority}] ${r.description}`);
        if (r.mitigation) lines.push(`       → Xử lý: ${r.mitigation}`);
      });
      openIssues.forEach(i => {
        lines.push(`   🐛 [${i.priority}] ${i.description}`);
        if (i.mitigation) lines.push(`       → Giải pháp: ${i.mitigation}`);
      });
    }
    lines.push('');
    lines.push('═══════════════════════════════════════');
    lines.push(`Báo cáo chuẩn bị bởi: ${project.pm_name || 'PM'}`);
  } else {
    lines.push('WEEKLY PROJECT STATUS REPORT');
    lines.push('═══════════════════════════════════════');
    lines.push(`Project  : ${project.name}`);
    lines.push(`Program  : ${project.program_name || project.client || 'N/A'}`);
    lines.push(`Phase    : ${project.current_phase}`);
    lines.push(`Period   : ${fmtDateLong(startDate)} – ${fmtDateLong(endDate)}`);
    lines.push(`Date     : ${today}`);
    lines.push(`PM       : ${project.pm_name || 'N/A'}`);
    lines.push('═══════════════════════════════════════');
    lines.push('');
    lines.push(`📊 OVERALL PROGRESS: ${stats.completion_pct}% (Done: ${stats.done} | In-Progress: ${stats.inProgress} | Not Started: ${stats.notStarted} | Total: ${stats.total} US)`);
    lines.push(`🚦 STATUS: ${health}`);
    if (epicStats?.length > 0) {
      lines.push('');
      lines.push('───────────────────────────────────────');
      lines.push('📁 PROGRESS BY EPIC');
      lines.push('───────────────────────────────────────');
      epicStats.forEach(e => {
        const bar = '█'.repeat(Math.round(e.pct / 10)) + '░'.repeat(10 - Math.round(e.pct / 10));
        lines.push(`   ${e.phase}`);
        lines.push(`   [${bar}] ${e.pct}%  (${e.done}/${e.total} US done)`);
      });
    }
    lines.push('');
    lines.push('───────────────────────────────────────');
    lines.push(`✅ COMPLETED THIS PERIOD (${doneThisWeek.length})`);
    lines.push('───────────────────────────────────────');
    if (doneThisWeek.length === 0) {
      lines.push('   – No activities completed this period.');
    } else {
      doneThisWeek.forEach(a => {
        lines.push(`   ✓ ${a.activity}${a.deliverable ? `\n     → Deliverable: ${a.deliverable}` : ''}`);
      });
    }
    lines.push('');
    lines.push('───────────────────────────────────────');
    lines.push(`🔄 IN PROGRESS (${inProgress.length})`);
    lines.push('───────────────────────────────────────');
    if (inProgress.length === 0) {
      lines.push('   – No activities currently in progress.');
    } else {
      inProgress.forEach(a => {
        lines.push(`   • ${a.activity} — ${a.completion_pct}%${a.plan_end ? ` (due: ${fmtDate(a.plan_end)})` : ''}`);
      });
    }
    lines.push('');
    lines.push('───────────────────────────────────────');
    lines.push(`📋 UPCOMING PLAN (${nextWeekPlan.length})`);
    lines.push('───────────────────────────────────────');
    if (nextWeekPlan.length === 0) {
      lines.push('   – No activities scheduled yet.');
    } else {
      nextWeekPlan.forEach(a => {
        lines.push(`   → ${a.activity}${a.plan_start ? ` (starts: ${fmtDate(a.plan_start)})` : ''}`);
      });
    }
    if (openRisks.length > 0 || openIssues.length > 0) {
      lines.push('');
      lines.push('───────────────────────────────────────');
      lines.push('⚠ RISKS & ISSUES');
      lines.push('───────────────────────────────────────');
      openRisks.forEach(r => {
        lines.push(`   🛡 [${r.priority}] ${r.description}`);
        if (r.mitigation) lines.push(`       → Mitigation: ${r.mitigation}`);
      });
      openIssues.forEach(i => {
        lines.push(`   🐛 [${i.priority}] ${i.description}`);
        if (i.mitigation) lines.push(`       → Resolution: ${i.mitigation}`);
      });
    }
    lines.push('');
    lines.push('═══════════════════════════════════════');
    lines.push(`Prepared by: ${project.pm_name || 'PM'}`);
  }
  return lines.join('\n');
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ProjectReportsListPage() {
  const { id } = useParams<{ id: string }>();

  // Date range (free selection)
  const [startDate, setStartDate] = useState(getThisMonday);
  const [endDate, setEndDate] = useState(getThisSunday);

  // Saved reports list
  const [savedReports, setSavedReports] = useState<DocRecord[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<number | null>(null);

  // Report data from API
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [report, setReport] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Settings
  const [language, setLanguage] = useState<'Vietnamese' | 'English'>('Vietnamese');
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [apiKeySet, setApiKeySet] = useState<false | 'db' | 'env'>(false);
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadConfig = useCallback(async () => {
    const res = await fetch('/api/config');
    const d = await res.json();
    if (d.anthropic_api_key_set === 'env') setApiKeySet('env');
    else if (d.anthropic_api_key_set === 'true') setApiKeySet('db');
    else setApiKeySet(false);
  }, []);

  const loadSavedReports = useCallback(async () => {
    const res = await fetch(`/api/projects/${id}/documents`);
    const docs: DocRecord[] = await res.json();
    const weekly = docs
      .filter(d => d.type === 'status_report')
      .sort((a, b) => b.title.localeCompare(a.title));
    setSavedReports(weekly);
  }, [id]);

  const loadData = useCallback(async () => {
    setLoadingData(true);
    try {
      const res = await fetch(`/api/projects/${id}/report?start=${startDate}&end=${endDate}`);
      const d = await res.json();
      setReportData(d);
    } finally {
      setLoadingData(false);
    }
  }, [id, startDate, endDate]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadSavedReports(); }, [loadSavedReports]);
  useEffect(() => { loadData(); }, [loadData]);

  // ── Report list actions ────────────────────────────────────────────────────

  const loadSavedReport = (doc: DocRecord) => {
    setSelectedDocId(doc.id);
    const content = JSON.parse(doc.content_json || '{}');
    if (content.report_text) setReport(content.report_text);
    if (content.start_date) setStartDate(content.start_date);
    if (content.end_date) setEndDate(content.end_date);
    if (content.language) setLanguage(content.language as 'Vietnamese' | 'English');
    if (content.mode) setMode(content.mode as 'manual' | 'ai');
  };

  const startNew = () => {
    setSelectedDocId(null);
    setReport('');
    setStartDate(getThisMonday());
    setEndDate(getThisSunday());
  };

  const deleteReport = async (docId: number, title: string) => {
    if (!confirm(`Delete "${title}"?`)) return;
    await fetch(`/api/projects/${id}/documents?docId=${docId}`, { method: 'DELETE' });
    if (selectedDocId === docId) startNew();
    setSavedReports(r => r.filter(d => d.id !== docId));
    toast.success('Report deleted');
  };

  // ── API key ────────────────────────────────────────────────────────────────

  const saveApiKey = async () => {
    if (!apiKeyInput.startsWith('sk-ant-')) { toast.error('Invalid key — must start with sk-ant-'); return; }
    setSavingKey(true);
    await fetch('/api/config', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropic_api_key: apiKeyInput }),
    });
    setApiKeyInput('');
    setShowKeyInput(false);
    await loadConfig();
    setSavingKey(false);
    toast.success('API key saved!');
  };

  // ── Generate ───────────────────────────────────────────────────────────────

  const generateManual = () => {
    if (!reportData) return;
    setReport(buildManualReport(reportData, language, startDate, endDate));
    toast.success('Report generated!');
  };

  const generateAI = async () => {
    if (!reportData) return;
    setGenerating(true);
    setReport('');
    try {
      const res = await fetch(`/api/projects/${id}/report`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reportData, language }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.error === 'NO_API_KEY') {
          toast.error('API key chưa cấu hình. Nhập key bên dưới.');
          setShowKeyInput(true);
        } else {
          toast.error(d.error ?? 'AI generation failed');
        }
        return;
      }
      setReport(d.report);
      toast.success('AI report generated!');
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerate = () => mode === 'ai' ? generateAI() : generateManual();

  // ── Save ───────────────────────────────────────────────────────────────────

  const saveReport = async () => {
    if (!report.trim()) { toast.error('Generate a report first'); return; }
    if (!startDate || !endDate) { toast.error('Set date range first'); return; }
    setSaving(true);
    const projName = reportData?.project.name ?? 'Project';
    const title = buildReportTitle(projName, startDate, endDate);
    const content = { report_text: report, start_date: startDate, end_date: endDate, language, mode, completion_pct: reportData?.stats.completion_pct ?? 0 };
    try {
      if (selectedDocId !== null) {
        await fetch(`/api/projects/${id}/documents`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: selectedDocId, title, content }),
        });
        toast.success('Report updated!');
      } else {
        const res = await fetch(`/api/projects/${id}/documents`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'status_report', title, content }),
        });
        const newDoc: DocRecord = await res.json();
        setSelectedDocId(newDoc.id);
        toast.success('Report saved!');
      }
      await loadSavedReports();
    } finally {
      setSaving(false);
    }
  };

  // ── Export ─────────────────────────────────────────────────────────────────

  const exportExcel = async () => {
    if (!report.trim() || !reportData) { toast.error('Generate a report first'); return; }
    setExporting(true);
    try {
      const res = await fetch(`/api/export/weekly-report/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report, reportData, startDate, endDate, language }),
      });
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `WeeklyReport_${reportData.project.name.replace(/\s+/g, '_')}_${startDate}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Excel exported!');
    } catch (e) { toast.error(String(e)); }
    finally { setExporting(false); }
  };

  const copyReport = () => { navigator.clipboard.writeText(report); toast.success('Copied!'); };

  const exportTxt = () => {
    if (!report || !reportData) return;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WeeklyReport_${reportData.project.name.replace(/\s+/g, '_')}_${startDate}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const hs = reportData ? healthStatus(reportData.stats.completion_pct) : null;

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Saved Reports Panel ── */}
      <div className="w-60 bg-white border-r flex flex-col shrink-0 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-3 border-b bg-slate-50">
          <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">Saved Reports</span>
          <Button size="sm" onClick={startNew} className="h-6 text-[11px] bg-blue-600 hover:bg-blue-700 gap-1 px-2">
            <Plus className="h-3 w-3" /> New
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {savedReports.length === 0 ? (
            <p className="text-xs text-slate-400 text-center py-10 px-3">No saved reports yet</p>
          ) : (
            <div className="divide-y">
              {savedReports.map(doc => {
                const dates = parseWeeklyTitle(doc.title);
                const content = JSON.parse(doc.content_json || '{}');
                const pct: number | undefined = content.completion_pct;
                const isSelected = doc.id === selectedDocId;
                return (
                  <div
                    key={doc.id}
                    onClick={() => loadSavedReport(doc)}
                    className={`px-3 py-2.5 cursor-pointer transition-colors group hover:bg-slate-50 ${isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0 flex-1">
                        {dates ? (
                          <>
                            <p className="text-[11px] font-medium text-slate-700 leading-tight">{formatDisplayDate(dates.from)}</p>
                            <p className="text-[10px] text-slate-400">→ {formatDisplayDate(dates.to)}</p>
                          </>
                        ) : (
                          <p className="text-[11px] text-slate-600 truncate">{doc.title}</p>
                        )}
                        {pct !== undefined && (
                          <p className="text-[10px] text-slate-400 mt-0.5">{pct}% complete</p>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); deleteReport(doc.id, doc.title); }}
                        className="text-slate-200 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0 mt-0.5"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Main Area ── */}
      <main className="flex-1 overflow-auto p-4 lg:p-5">
        <div className="max-w-5xl mx-auto">

          {/* Header */}
          <div className="mb-4">
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              {selectedDocId !== null ? 'Edit Weekly Report' : 'New Weekly Report'}
            </h1>
            {reportData && (
              <p className="text-sm text-slate-500 mt-0.5">
                {reportData.project.name}
                {(reportData.project.program_name || reportData.project.client) && (
                  <> · <span className="text-blue-600">{reportData.project.program_name || reportData.project.client}</span></>
                )}
              </p>
            )}
          </div>

          {/* Controls bar */}
          <div className="bg-white rounded-xl border p-4 mb-5 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              {/* Date range */}
              <div className="flex items-center gap-2 bg-slate-50 border rounded-lg px-3 py-1.5">
                <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
                <label className="text-xs text-slate-400 shrink-0">From</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="text-sm border-none outline-none bg-transparent"
                />
                <span className="text-xs text-slate-300 shrink-0">→</span>
                <label className="text-xs text-slate-400 shrink-0">To</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="text-sm border-none outline-none bg-transparent"
                />
              </div>

              {/* Language */}
              <Select value={language} onValueChange={v => setLanguage((v ?? 'Vietnamese') as 'Vietnamese' | 'English')}>
                <SelectTrigger className="w-36 h-9 text-sm bg-slate-50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vietnamese">🇻🇳 Tiếng Việt</SelectItem>
                  <SelectItem value="English">🇬🇧 English</SelectItem>
                </SelectContent>
              </Select>

              {/* Refresh data */}
              <Button onClick={loadData} variant="outline" className="h-9 gap-2 text-sm" disabled={loadingData}>
                <RefreshCw className={`h-3.5 w-3.5 ${loadingData ? 'animate-spin' : ''}`} /> Reload Data
              </Button>

              <div className="ml-auto flex items-center gap-2">
                {/* Mode toggle */}
                <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
                  <button
                    onClick={() => setMode('manual')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'manual' ? 'bg-white shadow text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <Eye className="h-3.5 w-3.5" /> Template
                  </button>
                  <button
                    onClick={() => setMode('ai')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'ai' ? 'bg-white shadow text-violet-700' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <Sparkles className="h-3.5 w-3.5" /> AI (Claude)
                  </button>
                </div>

                {/* Generate */}
                <Button
                  onClick={handleGenerate}
                  disabled={generating || !reportData}
                  className={`h-9 gap-2 text-sm ${mode === 'ai' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {mode === 'ai'
                    ? <><Sparkles className={`h-3.5 w-3.5 ${generating ? 'animate-pulse' : ''}`} />{generating ? 'Đang tạo...' : 'Generate AI'}</>
                    : <><Eye className="h-3.5 w-3.5" /> Generate</>
                  }
                </Button>
              </div>
            </div>

            {/* AI key config */}
            {mode === 'ai' && (
              <div className={`rounded-lg px-4 py-3 text-xs flex items-center gap-3 flex-wrap border ${apiKeySet ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <KeyRound className={`h-4 w-4 shrink-0 ${apiKeySet ? 'text-green-600' : 'text-amber-500'}`} />
                {apiKeySet === 'env' && <span className="text-green-700 font-medium">API key loaded from environment ✓</span>}
                {apiKeySet === 'db' && <span className="text-green-700 font-medium">Anthropic API key configured ✓</span>}
                {!apiKeySet && (
                  <>
                    <span className="text-amber-700">API key chưa cấu hình. </span>
                    <a
                      href="https://console.anthropic.com/settings/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 underline font-medium"
                    >
                      Lấy key tại console.anthropic.com →
                    </a>
                  </>
                )}
                {apiKeySet !== 'env' && (
                  <button onClick={() => setShowKeyInput(v => !v)} className="underline text-slate-500 hover:text-slate-700 ml-auto text-xs">
                    {apiKeySet ? 'Change key' : 'Enter key'}
                  </button>
                )}
                {showKeyInput && (
                  <div className="w-full flex gap-2 mt-1">
                    <Input
                      className="h-8 text-xs font-mono flex-1"
                      type="password"
                      placeholder="sk-ant-api03-..."
                      value={apiKeyInput}
                      onChange={e => setApiKeyInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && saveApiKey()}
                    />
                    <Button onClick={saveApiKey} disabled={savingKey} className="h-8 text-xs bg-green-600 hover:bg-green-700 shrink-0">
                      {savingKey ? 'Saving...' : 'Save Key'}
                    </Button>
                    <Button variant="outline" onClick={() => setShowKeyInput(false)} className="h-8 text-xs shrink-0">Cancel</Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Main 2-column layout */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

            {/* Left: data panels */}
            <div className="space-y-4">

              {/* Project health */}
              {reportData && hs && (
                <div className="bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-700">Project Health</h3>
                    <span className={`px-3 py-1 rounded-full text-xs font-bold border ${hs.cls}`}>{hs.label}</span>
                  </div>

                  {/* Overall % + risk/issue counts */}
                  <div className="flex gap-5 text-sm mb-3">
                    <div><p className="text-2xl font-bold text-slate-800">{reportData.stats.completion_pct}%</p><p className="text-xs text-slate-400">Weighted</p></div>
                    <div><p className="text-2xl font-bold text-red-500">{reportData.openRisks.length}</p><p className="text-xs text-slate-400">Risks</p></div>
                    <div><p className="text-2xl font-bold text-violet-500">{reportData.openIssues.length}</p><p className="text-xs text-slate-400">Issues</p></div>
                  </div>

                  {/* Progress bar */}
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden mb-4">
                    <div
                      className={`h-full rounded-full ${reportData.stats.completion_pct >= 70 ? 'bg-green-500' : reportData.stats.completion_pct >= 40 ? 'bg-blue-500' : 'bg-amber-400'}`}
                      style={{ width: `${reportData.stats.completion_pct}%` }}
                    />
                  </div>

                  {/* 3-group US stats */}
                  <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-green-50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-green-700">{reportData.stats.done}</p>
                      <p className="text-[10px] text-green-600">{language === 'Vietnamese' ? 'Hoàn thành' : 'Done'}</p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-blue-700">{reportData.stats.inProgress}</p>
                      <p className="text-[10px] text-blue-600">{language === 'Vietnamese' ? 'Đang làm' : 'In Progress'}</p>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 text-center">
                      <p className="text-lg font-bold text-slate-500">{reportData.stats.notStarted}</p>
                      <p className="text-[10px] text-slate-400">{language === 'Vietnamese' ? 'Chưa làm' : 'Not Started'}</p>
                    </div>
                  </div>

                  {/* Epic breakdown */}
                  {reportData.epicStats?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                        {language === 'Vietnamese' ? 'Tiến độ theo Epic' : 'Progress by Epic'}
                      </p>
                      <div className="space-y-2">
                        {reportData.epicStats.map(e => (
                          <div key={e.phase}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs text-slate-600 truncate max-w-[70%]">{e.phase}</span>
                              <span className="text-xs font-medium text-slate-700 shrink-0">
                                {e.pct}% <span className="text-slate-400 font-normal">({e.done}/{e.total})</span>
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${e.pct >= 70 ? 'bg-green-400' : e.pct >= 40 ? 'bg-blue-400' : 'bg-amber-400'}`}
                                style={{ width: `${e.pct}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Completed this period */}
              <div className="bg-white rounded-xl border p-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {language === 'Vietnamese' ? 'Hoàn thành trong kỳ' : 'Completed This Period'}
                  <Badge className="bg-green-100 text-green-700 text-[10px] ml-auto">{reportData?.doneThisWeek.length ?? 0}</Badge>
                </h3>
                {loadingData ? <p className="text-xs text-slate-400 animate-pulse">Loading...</p>
                  : !reportData?.doneThisWeek.length
                  ? <p className="text-xs text-slate-400 italic">{language === 'Vietnamese' ? 'Không có công việc hoàn thành trong kỳ này.' : 'No activities completed this period.'}</p>
                  : (
                    <ul className="space-y-2">
                      {reportData.doneThisWeek.map(a => (
                        <li key={a.id} className="flex items-start gap-2 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 text-green-400 mt-0.5 shrink-0" />
                          <div>
                            <span className="text-slate-700">{a.activity}</span>
                            {a.deliverable && <span className="text-slate-400 text-xs ml-1">→ {a.deliverable}</span>}
                            {a.actual_end && <span className="text-[10px] text-slate-300 ml-1">({fmtDate(a.actual_end)})</span>}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>

              {/* In progress */}
              <div className="bg-white rounded-xl border p-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-blue-500" />
                  {language === 'Vietnamese' ? 'Đang thực hiện' : 'In Progress'}
                  <Badge className="bg-blue-100 text-blue-700 text-[10px] ml-auto">{reportData?.inProgress.length ?? 0}</Badge>
                </h3>
                {!reportData?.inProgress.length
                  ? <p className="text-xs text-slate-400 italic">{language === 'Vietnamese' ? 'Không có công việc đang thực hiện.' : 'No activities in progress.'}</p>
                  : (
                    <ul className="space-y-2">
                      {reportData.inProgress.map(a => (
                        <li key={a.id} className="flex items-start gap-2 text-sm">
                          <div className="mt-1 shrink-0"><div className="w-3.5 h-3.5 rounded-full border-2 border-blue-400 bg-white" /></div>
                          <div className="flex-1 min-w-0">
                            <span className="text-slate-700">{a.activity}</span>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1 bg-slate-100 rounded-full"><div className="h-full bg-blue-400 rounded-full" style={{ width: `${a.completion_pct}%` }} /></div>
                              <span className="text-[10px] text-slate-400 shrink-0">{a.completion_pct}%</span>
                              {a.plan_end && <span className="text-[10px] text-slate-300 shrink-0">{language === 'Vietnamese' ? 'hạn' : 'due'} {fmtDate(a.plan_end)}</span>}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
              </div>

              {/* Next period plan */}
              <div className="bg-white rounded-xl border p-4">
                <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                  <ChevronRight className="h-4 w-4 text-amber-500" />
                  {language === 'Vietnamese' ? 'Kế hoạch tiếp theo' : 'Upcoming Plan'}
                  <Badge className="bg-amber-100 text-amber-700 text-[10px] ml-auto">{reportData?.nextWeekPlan.length ?? 0}</Badge>
                </h3>
                {!reportData?.nextWeekPlan.length
                  ? <p className="text-xs text-slate-400 italic">{language === 'Vietnamese' ? 'Chưa có kế hoạch.' : 'No upcoming activities.'}</p>
                  : (
                    <ul className="space-y-1.5">
                      {reportData.nextWeekPlan.map(a => (
                        <li key={a.id} className="flex items-start gap-2 text-sm">
                          <span className="text-amber-400 mt-0.5 shrink-0">→</span>
                          <span className="text-slate-700">{a.activity}</span>
                          {a.plan_start && <span className="text-[10px] text-slate-300 ml-auto shrink-0">{fmtDate(a.plan_start)}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
              </div>

              {/* Risks + issues */}
              {((reportData?.openRisks.length ?? 0) + (reportData?.openIssues.length ?? 0)) > 0 && (
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    {language === 'Vietnamese' ? 'Rủi ro & Vấn đề' : 'Risks & Issues'}
                  </h3>
                  {reportData?.openRisks.map(r => (
                    <div key={r.id} className="flex items-start gap-2 text-sm mb-2">
                      <ShieldAlert className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
                      <div><PriorityDot p={r.priority} /><span className="text-slate-700">{r.description}</span>
                        {r.mitigation && <p className="text-xs text-slate-400 ml-3">↳ {r.mitigation}</p>}
                      </div>
                    </div>
                  ))}
                  {reportData?.openIssues.map(i => (
                    <div key={i.id} className="flex items-start gap-2 text-sm mb-2">
                      <Bug className="h-3.5 w-3.5 text-violet-400 mt-0.5 shrink-0" />
                      <div><PriorityDot p={i.priority} /><span className="text-slate-700">{i.description}</span>
                        {i.mitigation && <p className="text-xs text-slate-400 ml-3">↳ {i.mitigation}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right: generated report */}
            <div className="flex flex-col gap-4">
              <div className="bg-white rounded-xl border flex flex-col" style={{ minHeight: 520 }}>
                {/* Report header */}
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
                  <div className="flex items-center gap-2">
                    {mode === 'ai' ? <Sparkles className="h-4 w-4 text-violet-500" /> : <Eye className="h-4 w-4 text-blue-500" />}
                    <span className="text-sm font-bold text-slate-700">
                      {selectedDocId !== null ? 'Saved Report' : mode === 'ai' ? 'AI-Generated' : 'Template Report'}
                    </span>
                  </div>
                  {report && (
                    <div className="flex gap-1.5 flex-wrap">
                      <Button variant="outline" onClick={copyReport} className="h-7 text-xs gap-1 px-2">
                        <Copy className="h-3 w-3" /> Copy
                      </Button>
                      <Button variant="outline" onClick={exportTxt} className="h-7 text-xs gap-1 px-2">
                        <Download className="h-3 w-3" /> .txt
                      </Button>
                      <Button
                        onClick={exportExcel}
                        disabled={exporting}
                        className="h-7 text-xs gap-1 px-2 bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Download className="h-3 w-3" />
                        {exporting ? '...' : '.xlsx'}
                      </Button>
                      <Button
                        onClick={saveReport}
                        disabled={saving}
                        className="h-7 text-xs gap-1 px-2 bg-blue-600 hover:bg-blue-700"
                      >
                        <Save className="h-3 w-3" />
                        {saving ? 'Saving...' : selectedDocId !== null ? 'Update' : 'Save'}
                      </Button>
                    </div>
                  )}
                </div>

                {/* Empty state */}
                {!report && !generating && (
                  <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center px-8 py-12">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${mode === 'ai' ? 'bg-violet-50' : 'bg-blue-50'}`}>
                      {mode === 'ai' ? <Sparkles className="h-7 w-7 text-violet-300" /> : <FileText className="h-7 w-7 text-blue-300" />}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-700 mb-1">{mode === 'ai' ? 'AI Report (Claude)' : 'Template Report'}</p>
                      <p className="text-sm text-slate-400">
                        {mode === 'ai'
                          ? 'Claude tổng hợp dữ liệu và viết báo cáo chuyên nghiệp cho CEO.'
                          : 'Tự động điền dữ liệu vào template — không cần API key, tức thì.'}
                      </p>
                    </div>
                    <button
                      onClick={handleGenerate}
                      disabled={!reportData}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${mode === 'ai' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-40`}
                    >
                      {mode === 'ai' ? <><Sparkles className="h-4 w-4" /> Generate AI Report</> : <><Eye className="h-4 w-4" /> Generate Report</>}
                    </button>
                  </div>
                )}

                {/* Generating */}
                {generating && (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                      <Sparkles className="h-8 w-8 text-violet-400 mx-auto mb-3 animate-pulse" />
                      <p className="text-sm text-slate-400">Claude đang viết báo cáo...</p>
                    </div>
                  </div>
                )}

                {/* Report text */}
                {report && !generating && (
                  <div className="flex-1 p-4">
                    <Textarea
                      className="w-full h-full min-h-[440px] text-sm leading-relaxed border-none shadow-none resize-none focus-visible:ring-0 p-0 text-slate-700 font-mono"
                      value={report}
                      onChange={e => setReport(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* Mode tip */}
              <div className={`rounded-xl px-4 py-3 text-xs flex items-start gap-2 border ${mode === 'ai' ? 'bg-violet-50 border-violet-100 text-violet-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
                {mode === 'ai'
                  ? <><Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span><strong>AI mode:</strong> Claude đọc dữ liệu và viết báo cáo tự nhiên, phù hợp trình bày với CEO. Yêu cầu Anthropic API key (<a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="underline">lấy key miễn phí</a>).</span></>
                  : <><TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span><strong>Template mode:</strong> Tự động điền dữ liệu — không cần AI, không cần internet. Dùng được ngay.</span></>
                }
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
