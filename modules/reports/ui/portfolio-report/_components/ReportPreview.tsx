'use client';
import { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Eye, Copy, Download, Mail, FileText, TrendingUp, Image, FileDown, Loader2 } from 'lucide-react';
import type { PortfolioReportData } from '../types';

export type ReportPreviewProps = {
  data: PortfolioReportData | null;
  loading: boolean;
  mode: 'manual' | 'ai';
  report: string;
  setReport: (v: string) => void;
  htmlReport: string;
  generating: boolean;
  viewMode: 'preview' | 'source';
  setViewMode: (m: 'preview' | 'source') => void;
  previewRef: RefObject<HTMLDivElement | null>;
  exporting: 'png' | 'pdf' | null;
  handleGenerate: () => void;
  copyReport: () => void;
  exportPng: () => void;
  exportPdf: () => void;
  exportHtml: () => void;
  exportTxt: () => void;
  openEmailModal: () => void;
  ceoEmail: string;
  setCeoEmail: (v: string) => void;
  savingEmail: boolean;
  saveCeoEmail: () => void;
};

export function ReportPreview({
  data, loading, mode, report, setReport, htmlReport, generating, viewMode, setViewMode,
  previewRef, exporting, handleGenerate, copyReport, exportPng, exportPdf, exportHtml, exportTxt,
  openEmailModal, ceoEmail, setCeoEmail, savingEmail, saveCeoEmail,
}: ReportPreviewProps) {
  return (
<>
    {/* ── 5. Report Generation Panel ── */}
    <div className="bg-white border rounded-xl overflow-hidden">
    <div className="flex items-center justify-between px-5 py-3.5 bg-slate-800">
    <h2 className="text-sm font-bold text-white flex items-center gap-2">
    {mode === 'ai' ? <Sparkles className="h-4 w-4 text-violet-300" /> : <FileText className="h-4 w-4 text-slate-300" />}
    Generate Report for CEO
    </h2>
    {report && (
    <div className="flex items-center gap-1.5 flex-wrap">
    <div className="flex items-center bg-slate-700 rounded-md p-0.5 mr-1">
    <button
    onClick={() => setViewMode('preview')}
    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'preview' ? 'bg-white text-slate-800' : 'text-slate-300 hover:text-white'}`}
    >
    <Eye className="h-3 w-3 inline mr-1" />Preview
    </button>
    <button
    onClick={() => setViewMode('source')}
    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${viewMode === 'source' ? 'bg-white text-slate-800' : 'text-slate-300 hover:text-white'}`}
    >
    Plain Text
    </button>
    </div>
    <Button variant="outline" onClick={copyReport} title={viewMode === 'preview' ? 'Copy HTML — paste into email to keep formatting' : 'Copy plain text'} className="h-7 text-xs gap-1 px-2 border-slate-600 text-slate-200 hover:text-slate-900 bg-transparent hover:bg-white">
    <Copy className="h-3 w-3" /> {viewMode === 'preview' ? 'Copy for Email' : 'Copy'}
    </Button>
    <Button variant="outline" onClick={exportPng} disabled={!htmlReport || !!exporting} className="h-7 text-xs gap-1 px-2 border-slate-600 text-slate-200 hover:text-slate-900 bg-transparent hover:bg-white disabled:opacity-50">
    {exporting === 'png' ? <Loader2 className="h-3 w-3 animate-spin" /> : <Image className="h-3 w-3" />} .png
    </Button>
    <Button variant="outline" onClick={exportPdf} disabled={!htmlReport || !!exporting} className="h-7 text-xs gap-1 px-2 border-slate-600 text-slate-200 hover:text-slate-900 bg-transparent hover:bg-white disabled:opacity-50">
    {exporting === 'pdf' ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileDown className="h-3 w-3" />} .pdf
    </Button>
    <Button variant="outline" onClick={exportHtml} className="h-7 text-xs gap-1 px-2 border-slate-600 text-slate-200 hover:text-slate-900 bg-transparent hover:bg-white">
    <Download className="h-3 w-3" /> .html
    </Button>
    <Button variant="outline" onClick={exportTxt} className="h-7 text-xs gap-1 px-2 border-slate-600 text-slate-200 hover:text-slate-900 bg-transparent hover:bg-white">
    <Download className="h-3 w-3" /> .txt
    </Button>
    <Button onClick={openEmailModal} className="h-7 text-xs gap-1 px-2 bg-blue-600 hover:bg-blue-700">
    <Mail className="h-3 w-3" /> Gửi Email
    </Button>
    </div>
    )}
    </div>
    
    {!report && !generating && (
    <div className="flex flex-col items-center justify-center gap-4 text-center px-8 py-16">
    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${mode === 'ai' ? 'bg-violet-50' : 'bg-blue-50'}`}>
    {mode === 'ai' ? <Sparkles className="h-7 w-7 text-violet-300" /> : <FileText className="h-7 w-7 text-blue-300" />}
    </div>
    <div>
    <p className="font-semibold text-slate-700 mb-1">Portfolio Report</p>
    <p className="text-sm text-slate-400 max-w-sm mx-auto">
    {mode === 'ai'
    ? 'Claude synthesizes all portfolio data and writes a comprehensive CEO-ready status report including risks, milestones, and recommended actions.'
    : 'Auto-generates a structured PMO-grade report from live portfolio data — no AI required.'}
    </p>
    </div>
    <button
    onClick={handleGenerate}
    disabled={!data || loading}
    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium text-white transition-colors ${mode === 'ai' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'} disabled:opacity-40`}
    >
    {mode === 'ai'
    ? <><Sparkles className="h-4 w-4" /> Generate AI Report</>
    : <><Eye className="h-4 w-4" /> Generate Template Report</>
    }
    </button>
    </div>
    )}
    
    {generating && (
    <div className="flex items-center justify-center py-20">
    <div className="text-center">
    <Sparkles className="h-8 w-8 text-violet-400 mx-auto mb-3 animate-pulse" />
    <p className="text-sm text-slate-500">Claude is synthesizing your portfolio data...</p>
    <p className="text-xs text-slate-400 mt-1">Analyzing {data?.kpi.totalProjects} projects, {data?.topRisks.length} risks, {data?.upcomingMilestones.length} milestones</p>
    </div>
    </div>
    )}
    
    {report && !generating && (
    <div className="p-4">
    {viewMode === 'preview' ? (
    <div
    ref={previewRef}
    className={`border rounded-lg overflow-auto ${mode === 'manual' ? 'border-slate-200 bg-white' : 'border-slate-200 bg-white'}`}
    dangerouslySetInnerHTML={{ __html: htmlReport }}
    />
    ) : (
    <Textarea
    className="w-full min-h-[500px] text-sm leading-relaxed border border-slate-200 rounded-lg resize-none focus-visible:ring-1 focus-visible:ring-blue-400 p-4 text-slate-700 font-mono"
    value={report}
    onChange={e => setReport(e.target.value)}
    />
    )}
    </div>
    )}
    </div>
    
    {/* Email Config */}
    {report && (
    <div className="bg-white border rounded-xl p-4">
    <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 mb-3">
    <Mail className="h-4 w-4 text-blue-500" />
    Gửi Email Báo Cáo
    </h3>
    <div className="flex gap-2 items-end flex-wrap">
    <div className="flex-1 min-w-[200px]">
    <label className="text-xs text-slate-400 mb-1 block">Email mặc định (Lãnh đạo)</label>
    <Input
    type="email"
    className="h-9 text-sm"
    placeholder="ceo@example.com"
    value={ceoEmail}
    onChange={e => setCeoEmail(e.target.value)}
    />
    </div>
    <Button variant="outline" onClick={saveCeoEmail} disabled={savingEmail || !ceoEmail} className="h-9 text-xs shrink-0">
    {savingEmail ? 'Đang lưu...' : 'Lưu'}
    </Button>
    <Button onClick={openEmailModal} className="h-9 gap-2 text-sm bg-blue-600 hover:bg-blue-700 shrink-0">
    <Mail className="h-4 w-4" /> Soạn & Gửi Email
    </Button>
    </div>
    <p className="text-[11px] text-slate-400 mt-2">
    Claude sẽ tổng hợp dữ liệu report thành email chuyên nghiệp rồi gửi trực tiếp đến hộp thư người nhận.
    </p>
    </div>
    )}
    
    {/* Mode tip */}
    <div className={`rounded-xl px-4 py-3 text-xs flex items-start gap-2 border ${mode === 'ai' ? 'bg-violet-50 border-violet-100 text-violet-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
    {mode === 'ai'
    ? <><Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span><strong>AI mode:</strong> Claude reads all portfolio data including risks, issues, and milestones, then writes a comprehensive professional report. Requires Anthropic API key.</span></>
    : <><TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span><strong>Template mode:</strong> Automatically aggregates all project data into a structured PMO-grade report — no AI or internet required.</span></>
    }
    </div>
</>
  );
}
