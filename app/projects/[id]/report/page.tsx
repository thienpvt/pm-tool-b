'use client';
import { useState, useRef } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import {
  Sparkles, Copy, Download, Mail, KeyRound, RefreshCw,
  FileText, Calendar, Loader2, FileDown, BarChart2, Flag,
  ChevronDown, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useProjectReport } from './useProjectReport';
import type { SavedPrompt } from './types';
import { SAVED_PROMPTS_KEY, MAX_SAVED_PROMPTS } from './types';
import { fmtDate, getThisMonday, getThisSunday, mdToHtml, wrapEmailDocument } from './_components/helpers';
import { EMAIL_PROMPT_TEMPLATES } from './_components/EmailPrompts';
import { buildProjectHtmlReport } from './_components/HtmlReportBuilder';
import { buildProjectReport } from './_components/TemplateTextBuilder';

export default function ProjectReportPage() {
  const { id } = useParams<{ id: string }>();

  const [reportMode, setReportMode] = useState<'daterange' | 'milestone'>('daterange');
  const [periodStart, setPeriodStart] = useState(getThisMonday);
  const [periodEnd, setPeriodEnd] = useState(getThisSunday);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState('');
  const [showMilestoneSelector, setShowMilestoneSelector] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'source' | 'ai'>('preview');
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [language, setLanguage] = useState<'Vietnamese' | 'English'>('Vietnamese');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState('executive');
  const [customPromptText, setCustomPromptText] = useState('');
  const [generatedEmailHtml, setGeneratedEmailHtml] = useState('');
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [savePromptName, setSavePromptName] = useState('');
  const [exporting, setExporting] = useState<'pdf' | null>(null);
  const previewRef = useRef<HTMLDivElement>(null);

  const {
    data, loading, report, setReport, htmlReport, setHtmlReport, aiReport, setAiReport,
    apiKeySet, pmEmail, setPmEmail, companyName, savedPrompts, setSavedPrompts,
    loadConfig, loadData, generateAiReport, generateEmailContent, sendEmailViaApi,
  } = useProjectReport({ projectId: id, reportMode, periodStart, periodEnd, selectedMilestoneId });

  // Generate report
  const handleGenerate = async () => {
    if (!data) { toast.error('Chưa có dữ liệu — nhấn Reload trước'); return; }
    setGenerating(true);
    try {
      if (mode === 'manual') {
        const txt = buildProjectReport(data, language);
        const htmlR = buildProjectHtmlReport(data, language, companyName);
        setReport(txt);
        setHtmlReport(htmlR);
        setViewMode('preview');
        setAiReport('');
      } else {
        const j = await generateAiReport(language);
        if (j.error === 'NO_API_KEY') { toast.error('No Anthropic API key configured'); return; }
        if (j.error) throw new Error(j.error);
        setAiReport(j.report);
        const htmlR = buildProjectHtmlReport(data, language, companyName);
        setHtmlReport(htmlR);
        setViewMode('ai');
      }
    } catch (e) { toast.error(String(e)); }
    finally { setGenerating(false); }
  };

  const copyReport = () => {
    const text = viewMode === 'source' ? report : viewMode === 'ai' ? aiReport : htmlReport;
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const exportHtml = () => {
    if (!htmlReport) return;
    const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Project Report</title></head><body>${htmlReport}</body></html>`], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data?.project.name ?? 'project'}-report-${new Date().toISOString().slice(0,10)}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('HTML downloaded');
  };

  const exportTxt = () => {
    if (!report) return;
    const blob = new Blob([report], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${data?.project.name ?? 'project'}-report-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('TXT downloaded');
  };

  const exportPdf = async () => {
    if (!htmlReport) return;
    setExporting('pdf');
    try {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report</title><style>@media print{body{margin:0;padding:0;}}</style></head><body>${htmlReport}</body></html>`);
        win.document.close();
        win.focus();
        win.print();
        win.close();
      }
    } finally { setExporting(null); }
  };

  const saveApiKey = async () => {
    if (!apiKeyInput) return;
    setSavingKey(true);
    try {
      await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anthropic_api_key: apiKeyInput }) });
      setShowKeyInput(false); setApiKeyInput('');
      await loadConfig();
      toast.success('API key saved');
    } catch { toast.error('Failed to save API key'); }
    finally { setSavingKey(false); }
  };

  const savePmEmail = async () => {
    if (!pmEmail) return;
    setSavingEmail(true);
    try {
      await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ceo_email: pmEmail }) });
      toast.success('Email saved');
    } catch { toast.error('Failed to save email'); }
    finally { setSavingEmail(false); }
  };

  const openEmailModal = () => {
    if (!data) return;
    setEmailRecipients(pmEmail);
    setEmailSubject(`[${data.project.name}] Báo cáo tình trạng — ${new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}`);
    setGeneratedEmailHtml('');
    setSelectedPromptId('executive');
    setCustomPromptText('');
    setShowEmailModal(true);
  };

  const generateEmail = async () => {
    if (!data) return;
    setGeneratingEmail(true);
    setGeneratedEmailHtml('');
    try {
      const promptTemplate = EMAIL_PROMPT_TEMPLATES.find(t => t.id === selectedPromptId);
      const promptInstruction = customPromptText || promptTemplate?.text || '';
      const j = await generateEmailContent(promptInstruction, language);
      if (j.error === 'NO_API_KEY') { toast.error('No Anthropic API key configured'); return; }
      if (j.error) throw new Error(j.error);
      setGeneratedEmailHtml(j.emailHtml);
      if (j.subject) setEmailSubject(j.subject);
    } catch (e) { toast.error(String(e)); }
    finally { setGeneratingEmail(false); }
  };

  const sendEmail = async () => {
    if (!generatedEmailHtml || !emailRecipients) return;
    setSendingEmail(true);
    try {
      const toArr = emailRecipients.split(',').map(s => s.trim()).filter(Boolean);
      const htmlBody = wrapEmailDocument(generatedEmailHtml, companyName, data?.project.name ?? '');
      const j = await sendEmailViaApi(toArr, emailSubject, htmlBody);
      if (j.error) throw new Error(j.error === 'NO_RESEND_KEY' ? 'RESEND_API_KEY not configured' : j.error);
      toast.success(`Email sent to ${toArr.join(', ')}`);
      setShowEmailModal(false);
    } catch (e) { toast.error(String(e)); }
    finally { setSendingEmail(false); }
  };

  const savePrompt = () => {
    if (!savePromptName || !customPromptText) return;
    const newPrompt: SavedPrompt = { id: Date.now().toString(), name: savePromptName, text: customPromptText };
    const updated = [newPrompt, ...savedPrompts].slice(0, MAX_SAVED_PROMPTS);
    setSavedPrompts(updated);
    localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(updated));
    setShowSaveInput(false); setSavePromptName('');
    toast.success('Prompt saved');
  };

  const deletePrompt = (promptId: string) => {
    const updated = savedPrompts.filter(p => p.id !== promptId);
    setSavedPrompts(updated);
    localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(updated));
  };

  const hasReport = !!(htmlReport || report || aiReport);
  const activeView = viewMode === 'preview' ? htmlReport : viewMode === 'ai' ? mdToHtml(aiReport) : '';

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar projectId={id} />
      <main className="flex-1 min-w-0">

        {/* ── Top Header ───────────────────────────────────────────────────── */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <BarChart2 className="h-5 w-5 text-violet-600 shrink-0" />
            <div className="min-w-0">
              <h1 className="font-semibold text-slate-900 text-sm truncate">
                Project Status Report{data ? ` — ${data.project.name}` : ''}
              </h1>
              {data && (
                <p className="text-xs text-slate-500 mt-0.5">
                  {data.project.current_phase} · PM: {data.project.pm_name ?? 'N/A'} ·{' '}
                  {data.project.end_date ? `End: ${fmtDate(data.project.end_date)}` : 'No deadline'}
                  {data.project.days_until_deadline !== null && (
                    <span className={data.project.days_until_deadline < 0 ? 'text-red-600 font-medium' : 'text-slate-400'}>
                      {' '}({data.project.days_until_deadline < 0
                        ? `OVERDUE ${Math.abs(data.project.days_until_deadline)}d`
                        : `${data.project.days_until_deadline}d left`})
                    </span>
                  )}
                </p>
              )}
            </div>
          </div>
          {data && (
            <span className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
              data.project.rag === 'red' ? 'bg-red-100 text-red-700' :
              data.project.rag === 'amber' ? 'bg-amber-100 text-amber-700' :
              'bg-green-100 text-green-700'}`}>
              ● {data.project.rag === 'red' ? 'ĐỎ' : data.project.rag === 'amber' ? 'VÀNG' : 'XANH'}
            </span>
          )}
        </div>

        {/* ── KPI Bar ──────────────────────────────────────────────────────── */}
        {data && (
          <div className="bg-white border-b border-slate-200 grid grid-cols-2 md:grid-cols-4 divide-x divide-slate-100 shrink-0">
            {[
              { label: 'Total Activities', value: data.stats.total, sub: `${data.stats.inProgress} in progress`, color: 'text-slate-900' },
              { label: 'Completion', value: `${data.stats.completion_pct}%`, sub: `${data.stats.done} done`, color: data.stats.completion_pct >= 70 ? 'text-green-600' : data.stats.completion_pct >= 40 ? 'text-amber-600' : 'text-red-600' },
              { label: 'Open Risks', value: data.openRisks.length, sub: `${data.openRisks.filter(r=>r.priority==='Critical').length} critical`, color: data.openRisks.length > 0 ? 'text-red-600' : 'text-green-600' },
              { label: 'Open Issues', value: data.openIssues.length, sub: `${data.epicStats.length} epics/phases`, color: data.openIssues.length > 0 ? 'text-amber-600' : 'text-green-600' },
            ].map(k => (
              <div key={k.label} className="px-5 py-3">
                <div className={`text-2xl font-bold leading-none ${k.color}`}>{k.value}</div>
                <div className="text-xs text-slate-500 mt-1">{k.label}</div>
                <div className="text-xs text-slate-400 mt-0.5">{k.sub}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Main body ────────────────────────────────────────────────────── */}
        <div className="flex flex-col lg:flex-row gap-0 flex-1">

          {/* Left: Period + Completed Activities ──────────────────────────── */}
          <div className="lg:w-80 xl:w-96 shrink-0 border-r border-slate-200 bg-white flex flex-col">

            {/* Period selector */}
            <div className="p-4 border-b border-slate-100">
              <div className="flex rounded-lg overflow-hidden border bg-slate-50 mb-3">
                <button onClick={() => setReportMode('daterange')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${reportMode==='daterange'?'bg-violet-600 text-white':'text-slate-600 hover:bg-slate-100'}`}>
                  <Calendar className="h-3 w-3" /> Date Range
                </button>
                <button onClick={() => setReportMode('milestone')}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${reportMode==='milestone'?'bg-violet-600 text-white':'text-slate-600 hover:bg-slate-100'}`}>
                  <Flag className="h-3 w-3" /> Milestone
                </button>
              </div>

              {reportMode === 'daterange' ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 w-8 shrink-0">From</label>
                    <Input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className="h-7 text-xs flex-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-slate-500 w-8 shrink-0">To</label>
                    <Input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className="h-7 text-xs flex-1" />
                  </div>
                </div>
              ) : (
                <div>
                  <button onClick={() => setShowMilestoneSelector(!showMilestoneSelector)}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs border rounded-lg bg-white hover:bg-slate-50">
                    <span className="text-slate-600">
                      {selectedMilestoneId && data?.milestones
                        ? data.milestones.find(m => String(m.id) === selectedMilestoneId)?.name ?? 'Select milestone…'
                        : 'Select milestone…'}
                    </span>
                    <ChevronDown className="h-3 w-3 text-slate-400" />
                  </button>
                  {showMilestoneSelector && data?.milestones && (
                    <div className="mt-1 border rounded-lg bg-white shadow-sm max-h-48 overflow-y-auto">
                      {data.milestones.map(m => (
                        <button key={m.id} onClick={() => { setSelectedMilestoneId(String(m.id)); setShowMilestoneSelector(false); }}
                          className={`w-full text-left px-3 py-2 text-xs hover:bg-slate-50 ${selectedMilestoneId === String(m.id) ? 'bg-violet-50 text-violet-700 font-medium' : 'text-slate-700'}`}>
                          {m.name}
                          {m.start_date && <span className="text-slate-400 ml-1">({m.start_date}{m.end_date ? ` → ${m.end_date}` : ''})</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <Button size="sm" variant="outline" onClick={loadData} disabled={loading}
                className="w-full mt-3 gap-1.5 text-xs h-7">
                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {loading ? 'Loading…' : 'Reload Data'}
              </Button>
            </div>

            {/* Completed activities preview */}
            <div className="flex-1 overflow-y-auto p-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Completed in Period ({data?.completedInPeriod.length ?? 0})
              </p>
              {loading ? (
                <div className="flex items-center justify-center h-20"><Loader2 className="h-5 w-5 animate-spin text-slate-300" /></div>
              ) : data?.completedInPeriod.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">No activities completed in this period</p>
              ) : (
                data?.completedInPeriod.map(a => (
                  <div key={a.id} className="flex items-start gap-2 py-2 border-b border-slate-50 last:border-0">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs text-slate-700 font-medium leading-snug">{a.activity}</p>
                      {a.deliverable && <p className="text-xs text-slate-400 truncate">→ {a.deliverable}</p>}
                      {a.actual_end && <p className="text-xs text-slate-300">{a.actual_end}</p>}
                    </div>
                  </div>
                ))
              )}
              {data && data.openRisks.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                    Open Risks ({data.openRisks.length})
                  </p>
                  {data.openRisks.slice(0, 5).map(r => (
                    <div key={r.id} className="flex items-start gap-2 py-1.5">
                      <AlertTriangle className={`h-3 w-3 mt-0.5 shrink-0 ${r.priority==='Critical'?'text-red-500':r.priority==='High'?'text-orange-500':'text-amber-500'}`} />
                      <div className="min-w-0">
                        <span className={`text-xs font-medium ${r.priority==='Critical'?'text-red-700':r.priority==='High'?'text-orange-700':'text-amber-700'}`}>[{r.priority}] </span>
                        <span className="text-xs text-slate-600">{r.description.slice(0, 60)}{r.description.length > 60 ? '…' : ''}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Controls + Report ──────────────────────────────────────── */}
          <div className="flex-1 min-w-0 flex flex-col">

            {/* Controls bar */}
            <div className="bg-white border-b border-slate-200 px-5 py-3 flex flex-wrap items-center gap-3 shrink-0">
              {/* Language */}
              <Select value={language} onValueChange={(v) => v && setLanguage(v as 'Vietnamese' | 'English')}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Vietnamese">Vietnamese</SelectItem>
                  <SelectItem value="English">English</SelectItem>
                </SelectContent>
              </Select>

              {/* Mode toggle */}
              <div className="flex rounded-lg overflow-hidden border">
                <button onClick={() => setMode('manual')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${mode==='manual'?'bg-violet-600 text-white':'text-slate-600 hover:bg-slate-50'}`}>
                  <FileText className="h-3 w-3" /> Template
                </button>
                <button onClick={() => setMode('ai')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${mode==='ai'?'bg-violet-600 text-white':'text-slate-600 hover:bg-slate-50'}`}>
                  <Sparkles className="h-3 w-3" /> AI (Claude)
                </button>
              </div>

              {/* Generate */}
              <Button size="sm" onClick={handleGenerate} disabled={generating || loading || !data}
                className="gap-1.5 bg-violet-600 hover:bg-violet-700 h-8">
                {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BarChart2 className="h-3.5 w-3.5" />}
                {generating ? 'Generating…' : 'Generate Report'}
              </Button>

              {/* Export buttons */}
              {hasReport && (
                <div className="flex items-center gap-1.5 ml-auto">
                  {/* View mode */}
                  <div className="flex rounded-lg overflow-hidden border">
                    {htmlReport && (
                      <button onClick={() => setViewMode('preview')}
                        className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode==='preview'?'bg-slate-100 text-slate-700':'text-slate-500 hover:bg-slate-50'}`}>
                        HTML
                      </button>
                    )}
                    {report && (
                      <button onClick={() => setViewMode('source')}
                        className={`px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode==='source'?'bg-slate-100 text-slate-700':'text-slate-500 hover:bg-slate-50'}`}>
                        Text
                      </button>
                    )}
                    {aiReport && (
                      <button onClick={() => setViewMode('ai')}
                        className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium transition-colors ${viewMode==='ai'?'bg-slate-100 text-slate-700':'text-slate-500 hover:bg-slate-50'}`}>
                        <Sparkles className="h-3 w-3" /> AI
                      </button>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={copyReport} className="h-8 gap-1.5 text-xs">
                    <Copy className="h-3 w-3" /> Copy
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportHtml} className="h-8 gap-1.5 text-xs" disabled={!htmlReport}>
                    <FileDown className="h-3 w-3" /> HTML
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportTxt} className="h-8 gap-1.5 text-xs" disabled={!report}>
                    <FileDown className="h-3 w-3" /> TXT
                  </Button>
                  <Button size="sm" variant="outline" onClick={exportPdf} className="h-8 gap-1.5 text-xs" disabled={!htmlReport || exporting === 'pdf'}>
                    {exporting === 'pdf' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />} PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={openEmailModal} className="h-8 gap-1.5 text-xs border-violet-200 text-violet-700 hover:bg-violet-50" disabled={!data}>
                    <Mail className="h-3 w-3" /> Send Email
                  </Button>
                </div>
              )}
            </div>

            {/* Config bar */}
            <div className="bg-slate-50 border-b border-slate-200 px-5 py-2 flex flex-wrap items-center gap-4 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <KeyRound className="h-3 w-3 text-slate-400" />
                <span className="text-slate-500">API Key:</span>
                {apiKeySet ? (
                  <span className="text-green-600 font-medium">✓ {apiKeySet === 'env' ? 'env var' : 'saved'}</span>
                ) : (
                  <span className="text-red-500">Not set</span>
                )}
                {apiKeySet !== 'env' && (
                  <button onClick={() => setShowKeyInput(!showKeyInput)} className="text-violet-600 hover:underline">
                    {showKeyInput ? 'Cancel' : apiKeySet ? 'Change' : 'Add key'}
                  </button>
                )}
                {showKeyInput && (
                  <div className="flex items-center gap-1.5">
                    <Input type="password" value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} placeholder="sk-ant-…" className="h-6 text-xs w-44" />
                    <Button size="sm" onClick={saveApiKey} disabled={savingKey} className="h-6 text-xs px-2 bg-violet-600 hover:bg-violet-700">
                      {savingKey ? '…' : 'Save'}
                    </Button>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-3 w-3 text-slate-400" />
                <span className="text-slate-500">PM/Sponsor email:</span>
                <Input value={pmEmail} onChange={e => setPmEmail(e.target.value)} placeholder="pm@company.com" className="h-6 text-xs w-44" />
                <Button size="sm" onClick={savePmEmail} disabled={savingEmail} className="h-6 text-xs px-2 bg-violet-600 hover:bg-violet-700">
                  {savingEmail ? '…' : 'Save'}
                </Button>
              </div>
            </div>

            {/* Report output */}
            <div className="flex-1 overflow-auto" ref={previewRef}>
              {!hasReport ? (
                <div className="h-full flex items-center justify-center text-slate-400">
                  <div className="text-center max-w-sm">
                    <BarChart2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-sm font-medium text-slate-500 mb-1">No report generated yet</p>
                    <p className="text-xs text-slate-400">Select a period and click <strong>Generate Report</strong></p>
                  </div>
                </div>
              ) : viewMode === 'source' ? (
                <pre className="p-6 text-xs font-mono text-slate-700 leading-relaxed whitespace-pre overflow-x-auto">{report}</pre>
              ) : (
                <div className="min-h-full bg-white">
                  <div dangerouslySetInnerHTML={{ __html: activeView }} />
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* ── Email Modal ─────────────────────────────────────────────────────── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-violet-600" />
                <h2 className="font-semibold text-slate-900 text-sm">Send Email Report</h2>
              </div>
              <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Recipients */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Recipients (comma-separated)</label>
                <Input value={emailRecipients} onChange={e => setEmailRecipients(e.target.value)} placeholder="sponsor@company.com, pm@company.com" className="text-sm" />
              </div>

              {/* Subject */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Subject</label>
                <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="text-sm" />
              </div>

              {/* Prompt template selector */}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-2">Email style (Claude will write the email)</label>
                <div className="grid grid-cols-2 gap-2 mb-3">
                  {EMAIL_PROMPT_TEMPLATES.map(t => (
                    <button key={t.id} onClick={() => { setSelectedPromptId(t.id); setCustomPromptText(''); }}
                      className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${selectedPromptId === t.id && !customPromptText ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Custom prompt */}
                <div>
                  <label className="text-xs text-slate-500 block mb-1">Or write custom instruction:</label>
                  <Textarea value={customPromptText} onChange={e => setCustomPromptText(e.target.value)}
                    placeholder="Describe how Claude should write this email…" rows={3} className="text-xs resize-none" />
                  {customPromptText && (
                    <div className="flex items-center gap-2 mt-1.5">
                      {!showSaveInput ? (
                        <button onClick={() => setShowSaveInput(true)} className="text-xs text-violet-600 hover:underline">Save prompt</button>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <Input value={savePromptName} onChange={e => setSavePromptName(e.target.value)} placeholder="Prompt name…" className="h-6 text-xs w-32" />
                          <Button size="sm" onClick={savePrompt} className="h-6 text-xs px-2 bg-violet-600 hover:bg-violet-700">Save</Button>
                          <button onClick={() => setShowSaveInput(false)} className="text-xs text-slate-400">Cancel</button>
                        </div>
                      )}
                    </div>
                  )}
                  {savedPrompts.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {savedPrompts.map(p => (
                        <div key={p.id} className="flex items-center gap-1 bg-slate-100 rounded px-2 py-0.5">
                          <button onClick={() => { setCustomPromptText(p.text); setSelectedPromptId(''); }} className="text-xs text-slate-600 hover:text-violet-600">{p.name}</button>
                          <button onClick={() => deletePrompt(p.id)} className="text-slate-300 hover:text-red-400 text-xs leading-none">×</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Generate with Claude */}
              <Button onClick={generateEmail} disabled={generatingEmail || !apiKeySet}
                className="w-full gap-2 bg-violet-600 hover:bg-violet-700">
                {generatingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {generatingEmail ? 'Claude is writing…' : 'Generate Email with Claude'}
              </Button>
              {!apiKeySet && <p className="text-xs text-center text-slate-400">Configure Anthropic API key first</p>}

              {/* Preview */}
              {generatedEmailHtml && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-slate-600">Email Preview</label>
                    <button onClick={() => navigator.clipboard.writeText(generatedEmailHtml).then(() => toast.success('Copied'))}
                      className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                      <Copy className="h-3 w-3" /> Copy HTML
                    </button>
                  </div>
                  <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto bg-white">
                    <div className="p-4 text-sm" dangerouslySetInnerHTML={{ __html: generatedEmailHtml }} />
                  </div>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={() => setShowEmailModal(false)} className="text-sm">Cancel</Button>
              <Button onClick={sendEmail} disabled={sendingEmail || !generatedEmailHtml || !emailRecipients}
                className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-sm">
                {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                {sendingEmail ? 'Sending…' : 'Send Email'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
