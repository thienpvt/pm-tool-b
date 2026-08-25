'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Sparkles, Copy, Download, Mail, KeyRound, RefreshCw,
  FileText, Calendar, Loader2, FileDown, BarChart2, Flag,
  ChevronDown, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import type { ReactNode } from 'react';
import type { ProjectReportData } from '../types';

export type ReportToolbarProps = {
  data: ProjectReportData | null;
  loading: boolean;
  reportMode: 'daterange' | 'milestone';
  setReportMode: (m: 'daterange' | 'milestone') => void;
  periodStart: string;
  setPeriodStart: (v: string) => void;
  periodEnd: string;
  setPeriodEnd: (v: string) => void;
  selectedMilestoneId: string;
  setSelectedMilestoneId: (v: string) => void;
  showMilestoneSelector: boolean;
  setShowMilestoneSelector: React.Dispatch<React.SetStateAction<boolean>>;
  loadData: () => void;
  language: 'Vietnamese' | 'English';
  setLanguage: (v: 'Vietnamese' | 'English') => void;
  mode: 'manual' | 'ai';
  setMode: (m: 'manual' | 'ai') => void;
  generating: boolean;
  handleGenerate: () => void;
  hasReport: boolean;
  htmlReport: string;
  report: string;
  aiReport: string;
  viewMode: 'preview' | 'source' | 'ai';
  setViewMode: (v: 'preview' | 'source' | 'ai') => void;
  copyReport: () => void;
  exportHtml: () => void;
  exportTxt: () => void;
  exportPdf: () => void;
  exporting: 'pdf' | null;
  openEmailModal: () => void;
  apiKeySet: false | 'db' | 'env';
  showKeyInput: boolean;
  setShowKeyInput: React.Dispatch<React.SetStateAction<boolean>>;
  apiKeyInput: string;
  setApiKeyInput: (v: string) => void;
  savingKey: boolean;
  saveApiKey: () => void;
  pmEmail: string;
  setPmEmail: (v: string) => void;
  savingEmail: boolean;
  savePmEmail: () => void;
  children?: ReactNode;
};

export function ReportToolbar(props: ReportToolbarProps) {
  const {
    data, loading, reportMode, setReportMode, periodStart, setPeriodStart, periodEnd, setPeriodEnd,
    selectedMilestoneId, setSelectedMilestoneId, showMilestoneSelector, setShowMilestoneSelector, loadData,
    language, setLanguage, mode, setMode, generating, handleGenerate, hasReport,
    htmlReport, report, aiReport, viewMode, setViewMode, copyReport, exportHtml, exportTxt, exportPdf,
    exporting, openEmailModal, apiKeySet, showKeyInput, setShowKeyInput, apiKeyInput, setApiKeyInput,
    savingKey, saveApiKey, pmEmail, setPmEmail, savingEmail, savePmEmail, children,
  } = props;

  return (
    <>
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
      <div className="flex-1 min-w-0 flex flex-col">
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
        {children}
      </div>
    </>
  );
}