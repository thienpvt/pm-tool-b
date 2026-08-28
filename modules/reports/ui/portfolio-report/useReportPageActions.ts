import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { PortfolioReportData, SavedPrompt } from './types';
import { SAVED_PROMPTS_KEY, MAX_SAVED_PROMPTS } from './types';
import { EMAIL_PROMPT_TEMPLATES } from './_components/EmailPromptTemplates';
import { buildTemplateReport } from './_components/buildTemplateReport';
import { buildHtmlReport } from './_components/buildHtmlReport';
import { filterDataByProjects } from './_components/filterDataByProjects';
import { mdToHtml } from './_components/markdownToHtml';
import { wrapEmailDocument } from './_components/emailDocWrapper';

export type ReportPageActionsParams = {
  data: PortfolioReportData | null;
  periodStart: string;
  periodEnd: string;
  companyName: string;
  language: 'Vietnamese' | 'English';
  mode: 'manual' | 'ai';
  bugDimension: 'status' | 'severity';
  selectedProjectIds: Set<number>;
  selectedPromptId: string;
  customPromptText: string;
  savedPrompts: SavedPrompt[];
  emailRecipients: string;
  emailSubject: string;
  generatedEmailHtml: string;
  htmlReport: string;
  report: string;
  viewMode: 'preview' | 'source';
  apiKeyInput: string;
  ceoEmail: string;
  savePromptName: string;
  showEmailModal: boolean;
  setReport: (v: string) => void;
  setHtmlReport: (v: string) => void;
  setViewMode: (v: 'preview' | 'source') => void;
  setGenerating: (v: boolean) => void;
  setExporting: (v: 'png' | 'pdf' | null) => void;
  setShowKeyInput: (v: boolean) => void;
  setApiKeyInput: (v: string) => void;
  setSavingKey: (v: boolean) => void;
  setSavingEmail: (v: boolean) => void;
  setEmailRecipients: (v: string) => void;
  setGeneratedEmailHtml: (v: string) => void;
  setEmailSubject: (v: string) => void;
  setShowSaveInput: (v: boolean) => void;
  setSavePromptName: (v: string) => void;
  setCustomPromptText: (v: string) => void;
  setShowEmailModal: (v: boolean) => void;
  setGeneratingEmail: (v: boolean) => void;
  setSendingEmail: (v: boolean) => void;
  setSavedPrompts: React.Dispatch<React.SetStateAction<SavedPrompt[]>>;
  setSelectedProgramIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  setSelectedProjectIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  loadConfig: () => Promise<void>;
};

export function useReportPageActions(p: ReportPageActionsParams) {
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (p.showEmailModal) {
      try {
        const stored = localStorage.getItem(SAVED_PROMPTS_KEY);
        if (stored) p.setSavedPrompts(JSON.parse(stored));
      } catch { /* ignore */ }
    }
  }, [p.showEmailModal, p.setSavedPrompts]);

  useEffect(() => {
    if (p.data) {
      p.setSelectedProgramIds(new Set());
      p.setSelectedProjectIds(new Set());
    }
  }, [p.data, p.setSelectedProgramIds, p.setSelectedProjectIds]);

  const saveApiKey = async () => {
    if (!p.apiKeyInput.startsWith('sk-ant-')) { toast.error('Invalid key — must start with sk-ant-'); return; }
    p.setSavingKey(true);
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anthropic_api_key: p.apiKeyInput }) });
    p.setApiKeyInput(''); p.setShowKeyInput(false);
    await p.loadConfig(); p.setSavingKey(false);
    toast.success('API key saved!');
  };

  const saveCeoEmail = async () => {
    p.setSavingEmail(true);
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ceo_email: p.ceoEmail }) });
    p.setSavingEmail(false);
    toast.success('CEO email saved!');
  };

  const generateManual = () => {
    if (!p.data) return;
    const fd = p.selectedProjectIds.size > 0 ? filterDataByProjects(p.data, p.selectedProjectIds) : p.data;
    const ps = p.data.periodStart || p.periodStart;
    const pe = p.data.periodEnd   || p.periodEnd;
    p.setReport(buildTemplateReport(fd, p.language, ps, pe, p.companyName, p.bugDimension));
    p.setHtmlReport(buildHtmlReport(fd, p.language, ps, pe, p.companyName, p.bugDimension));
    p.setViewMode('preview');
    toast.success(`Portfolio report generated (${fd.kpi.totalProjects} projects)!`);
  };

  const generateAI = async () => {
    if (!p.data) return;
    p.setGenerating(true);
    p.setReport('');
    try {
      const fd = p.selectedProjectIds.size > 0 ? filterDataByProjects(p.data, p.selectedProjectIds) : p.data;
      const portfolioPayload = {
        reportDate: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
        periodStart: p.data.periodStart || p.periodStart,
        periodEnd: p.data.periodEnd   || p.periodEnd,
        kpi: fd.kpi,
        programs: fd.programs.map(c => ({
          name: c.name, industry: c.industry,
          projects: c.projects.map(pr => ({
            name: pr.name, program_name: pr.program_name, current_phase: pr.current_phase,
            completion_pct: pr.completion_pct, open_risks: pr.open_risks, open_issues: pr.open_issues,
            days_until_deadline: pr.days_until_deadline, rag: pr.rag, pm_name: pr.pm_name,
            done_activities: pr.done_activities, in_progress_activities: pr.in_progress_activities,
            not_started_activities: pr.not_started_activities, total_activities: pr.total_activities,
            epicStats: pr.epicStats,
          })),
        })),
        noProgramProjects: fd.noProgramProjects.map(pr => ({
          name: pr.name, program_name: '', current_phase: pr.current_phase,
          completion_pct: pr.completion_pct, open_risks: pr.open_risks, open_issues: pr.open_issues,
          days_until_deadline: pr.days_until_deadline, rag: pr.rag, pm_name: pr.pm_name,
          done_activities: pr.done_activities, in_progress_activities: pr.in_progress_activities,
          not_started_activities: pr.not_started_activities, total_activities: pr.total_activities,
          epicStats: pr.epicStats,
        })),
        topRisks: fd.topRisks.map(r => ({ priority: r.priority, description: r.description, project_name: r.project_name, program_name: r.program_name || '' })),
        topIssues: fd.topIssues.map(i => ({ priority: i.priority, description: i.description, project_name: i.project_name, program_name: i.program_name || '' })),
        upcomingMilestones: fd.upcomingMilestones.map(m => ({ plan_end: m.plan_end, activity: m.activity, project_name: m.project_name })),
        completedByProject: fd.completedByProject,
        language: p.language,
      };
      const res = await fetch('/api/portfolio/report', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioData: portfolioPayload, language: p.language }),
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.error === 'NO_API_KEY') { toast.error('API key not configured.'); p.setShowKeyInput(true); }
        else toast.error(d.error ?? 'AI generation failed');
        return;
      }
      p.setReport(d.report);
      p.setHtmlReport(mdToHtml(d.report));
      p.setViewMode('preview');
      toast.success('AI portfolio report generated!');
    } finally {
      p.setGenerating(false);
    }
  };

  const handleGenerate = () => p.mode === 'ai' ? generateAI() : generateManual();

  const copyReport = async () => {
    if (p.viewMode === 'preview' && p.htmlReport) {
      try {
        const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"><style type="text/css">a,a:link,a:visited,a:hover{color:inherit!important;text-decoration:none!important;}</style></head><body style="margin:0;padding:0;background:#f8fafc;">${p.htmlReport}</body></html>`;
        const blob = new Blob([fullHtml], { type: 'text/html' });
        await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
        toast.success('Copied with formatting — paste directly into email!');
        return;
      } catch { /* fall through */ }
    }
    navigator.clipboard.writeText(p.report);
    toast.success('Copied to clipboard!');
  };

  const exportTxt = () => {
    if (!p.report) return;
    const blob = new Blob([p.report], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PortfolioReport_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportHtml = () => {
    if (!p.htmlReport) return;
    const full = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no"><title>Portfolio Report</title><style type="text/css">a,a:link,a:visited,a:hover{color:inherit!important;text-decoration:none!important;}</style></head><body style="margin:0;background:#FFFFFF;">${p.htmlReport}</body></html>`;
    const blob = new Blob([full], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `PortfolioReport_${new Date().toISOString().slice(0, 10)}.html`;
    a.click(); URL.revokeObjectURL(url);
  };

  const exportPng = async () => {
    if (!p.htmlReport || !previewRef.current) return;
    p.setExporting('png');
    const el = previewRef.current;
    const prevOverflow = el.style.overflow;
    el.style.overflow = 'visible';
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(el, { pixelRatio: 1.5, backgroundColor: '#FFFFFF', cacheBust: true });
      el.style.overflow = prevOverflow;
      const a = document.createElement('a');
      a.download = `PortfolioReport_${new Date().toISOString().slice(0, 10)}.png`;
      a.href = dataUrl;
      a.click();
      toast.success('Đã xuất PNG!');
    } catch {
      el.style.overflow = prevOverflow;
      toast.error('Xuất PNG thất bại');
    } finally {
      p.setExporting(null);
    }
  };

  const exportPdf = async () => {
    if (!p.htmlReport || !previewRef.current) return;
    p.setExporting('pdf');
    const el = previewRef.current;
    const prevOverflow = el.style.overflow;
    el.style.overflow = 'visible';
    try {
      const { toJpeg } = await import('html-to-image');
      const dataUrl = await toJpeg(el, { pixelRatio: 3, quality: 0.95, backgroundColor: '#FFFFFF', cacheBust: true });
      el.style.overflow = prevOverflow;
      const { jsPDF } = await import('jspdf');
      const imgW = el.scrollWidth * 3;
      const imgH = el.scrollHeight * 3;
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const scaledH = pdfW * (imgH / imgW);
      let y = 0;
      pdf.addImage(dataUrl, 'JPEG', 0, y, pdfW, scaledH);
      let remaining = scaledH - pdfH;
      while (remaining > 0) {
        y -= pdfH;
        pdf.addPage();
        pdf.addImage(dataUrl, 'JPEG', 0, y, pdfW, scaledH);
        remaining -= pdfH;
      }
      pdf.save(`PortfolioReport_${new Date().toISOString().slice(0, 10)}.pdf`);
      toast.success('Đã xuất PDF!');
    } catch {
      el.style.overflow = prevOverflow;
      toast.error('Xuất PDF thất bại');
    } finally {
      p.setExporting(null);
    }
  };

  const openEmailModal = () => {
    if (!p.data) { toast.error('Chưa có dữ liệu portfolio'); return; }
    p.setEmailRecipients(p.ceoEmail || '');
    p.setGeneratedEmailHtml('');
    p.setEmailSubject('');
    p.setShowSaveInput(false);
    p.setSavePromptName('');
    const tpl = EMAIL_PROMPT_TEMPLATES.find(t => t.id === p.selectedPromptId) ?? EMAIL_PROMPT_TEMPLATES[0];
    if (!p.customPromptText) p.setCustomPromptText(tpl.instruction);
    p.setShowEmailModal(true);
  };

  const generateEmailContent = async () => {
    if (!p.data) return;
    p.setGeneratingEmail(true);
    p.setGeneratedEmailHtml('');
    try {
      const fd = p.selectedProjectIds.size > 0 ? filterDataByProjects(p.data, p.selectedProjectIds) : p.data;
      const template = EMAIL_PROMPT_TEMPLATES.find(t => t.id === p.selectedPromptId) ?? EMAIL_PROMPT_TEMPLATES[0];
      const instruction = p.customPromptText.trim() || template.instruction;
      const portfolioPayload = {
        reportDate: new Date().toLocaleDateString('vi-VN', { day: 'numeric', month: 'long', year: 'numeric' }),
        periodStart: p.data.periodStart || p.periodStart,
        periodEnd: p.data.periodEnd   || p.periodEnd,
        kpi: fd.kpi,
        programs: fd.programs.map(c => ({
          name: c.name, industry: c.industry,
          projects: c.projects.map(pr => ({
            name: pr.name, current_phase: pr.current_phase, completion_pct: pr.completion_pct,
            open_risks: pr.open_risks, open_issues: pr.open_issues,
            days_until_deadline: pr.days_until_deadline, rag: pr.rag, pm_name: pr.pm_name,
            done_activities: pr.done_activities, total_activities: pr.total_activities,
          })),
        })),
        noProgramProjects: fd.noProgramProjects.map(pr => ({
          name: pr.name, current_phase: pr.current_phase, completion_pct: pr.completion_pct,
          open_risks: pr.open_risks, open_issues: pr.open_issues,
          days_until_deadline: pr.days_until_deadline, rag: pr.rag, pm_name: pr.pm_name,
          done_activities: pr.done_activities, total_activities: pr.total_activities,
        })),
        topRisks: fd.topRisks.map(r => ({ priority: r.priority, description: r.description, project_name: r.project_name })),
        topIssues: fd.topIssues.map(i => ({ priority: i.priority, description: i.description, project_name: i.project_name })),
        upcomingMilestones: fd.upcomingMilestones.map(m => ({ plan_end: m.plan_end, activity: m.activity, project_name: m.project_name })),
        completedByProject: fd.completedByProject,
        fteStats: fd.fteStats ?? null,
      };
      const res = await fetch('/api/portfolio/report/generate-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portfolioData: portfolioPayload, promptInstruction: instruction, language: p.language }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error === 'NO_API_KEY'
          ? 'Cần cấu hình Anthropic API key trước'
          : (d.error ?? 'Tạo nội dung email thất bại'));
        return;
      }
      p.setGeneratedEmailHtml(d.emailHtml);
      if (d.subject) p.setEmailSubject(d.subject);
    } finally {
      p.setGeneratingEmail(false);
    }
  };

  const sendEmailViaApi = async () => {
    const toList = p.emailRecipients.split(',').map(e => e.trim()).filter(e => e.includes('@'));
    if (!toList.length) { toast.error('Nhập ít nhất một email hợp lệ'); return; }
    if (!p.generatedEmailHtml) { toast.error('Vui lòng tạo nội dung email trước'); return; }
    p.setSendingEmail(true);
    try {
      const wrappedHtml = wrapEmailDocument(p.generatedEmailHtml, p.companyName);
      const res = await fetch('/api/portfolio/report/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: toList,
          subject: p.emailSubject || `[${p.companyName || 'PMO'}] Báo cáo Portfolio`,
          htmlBody: wrappedHtml,
          textBody: '',
        }),
      });
      const d = await res.json();
      if (!res.ok) {
        toast.error(d.error === 'NO_RESEND_KEY'
          ? 'Email chưa cấu hình — cần thêm RESEND_API_KEY vào biến môi trường server'
          : (d.error ?? 'Gửi email thất bại'));
        return;
      }
      toast.success(`Đã gửi báo cáo đến ${toList.join(', ')}`);
      p.setShowEmailModal(false);
    } finally {
      p.setSendingEmail(false);
    }
  };

  const savePrompt = () => {
    if (!p.savePromptName.trim() || !p.customPromptText.trim()) return;
    if (p.savedPrompts.length >= MAX_SAVED_PROMPTS) { toast.error(`Tối đa ${MAX_SAVED_PROMPTS} prompt đã lưu`); return; }
    const newPrompt: SavedPrompt = { id: Date.now().toString(), name: p.savePromptName.trim(), text: p.customPromptText };
    const updated = [...p.savedPrompts, newPrompt];
    p.setSavedPrompts(updated);
    try { localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
    p.setShowSaveInput(false);
    p.setSavePromptName('');
    toast.success(`Đã lưu prompt "${newPrompt.name}"`);
  };

  const deletePrompt = (id: string) => {
    const updated = p.savedPrompts.filter(sp => sp.id !== id);
    p.setSavedPrompts(updated);
    try { localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  };

  return {
    previewRef,
    saveApiKey,
    saveCeoEmail,
    handleGenerate,
    copyReport,
    exportTxt,
    exportHtml,
    exportPng,
    exportPdf,
    openEmailModal,
    generateEmailContent,
    sendEmailViaApi,
    savePrompt,
    deletePrompt,
  };
}
