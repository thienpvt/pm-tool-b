import { useRef } from 'react';
import { toast } from 'sonner';
import type { ProjectReportData, SavedPrompt } from './types';
import { SAVED_PROMPTS_KEY, MAX_SAVED_PROMPTS } from './types';
import { EMAIL_PROMPT_TEMPLATES } from './_components/EmailPrompts';
import { buildProjectHtmlReport } from './_components/HtmlReportBuilder';
import { buildProjectReport } from './_components/TemplateTextBuilder';
import { mdToHtml, wrapEmailDocument } from './_components/helpers';

export type ProjectReportPageActionsParams = {
  data: ProjectReportData | null;
  report: string;
  htmlReport: string;
  aiReport: string;
  viewMode: 'preview' | 'source' | 'ai';
  mode: 'manual' | 'ai';
  language: 'Vietnamese' | 'English';
  companyName: string;
  pmEmail: string;
  apiKeyInput: string;
  emailRecipients: string;
  emailSubject: string;
  generatedEmailHtml: string;
  selectedPromptId: string;
  customPromptText: string;
  savedPrompts: SavedPrompt[];
  savePromptName: string;
  setReport: (v: string) => void;
  setHtmlReport: (v: string) => void;
  setAiReport: (v: string) => void;
  setViewMode: (v: 'preview' | 'source' | 'ai') => void;
  setGenerating: (v: boolean) => void;
  setExporting: (v: 'pdf' | null) => void;
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
  setSelectedPromptId: (v: string) => void;
  setShowEmailModal: (v: boolean) => void;
  setGeneratingEmail: (v: boolean) => void;
  setSendingEmail: (v: boolean) => void;
  setSavedPrompts: React.Dispatch<React.SetStateAction<SavedPrompt[]>>;
  loadConfig: () => Promise<void>;
  generateAiReport: (language: string) => Promise<Record<string, string> | null>;
  generateEmailContent: (promptInstruction: string, language: string) => Promise<Record<string, string> | null>;
  sendEmailViaApi: (to: string[], subject: string, htmlBody: string) => Promise<Record<string, string>>;
};

export function useProjectReportPageActions(p: ProjectReportPageActionsParams) {
  const previewRef = useRef<HTMLDivElement>(null);

  const handleGenerate = async () => {
    if (!p.data) { toast.error('Chưa có dữ liệu — nhấn Reload trước'); return; }
    p.setGenerating(true);
    try {
      if (p.mode === 'manual') {
        const txt = buildProjectReport(p.data, p.language);
        const htmlR = buildProjectHtmlReport(p.data, p.language, p.companyName);
        p.setReport(txt);
        p.setHtmlReport(htmlR);
        p.setViewMode('preview');
        p.setAiReport('');
      } else {
        const j = await p.generateAiReport(p.language);
        if (!j) return;
        if (j.error === 'NO_API_KEY') { toast.error('No Anthropic API key configured'); return; }
        if (j.error) throw new Error(j.error);
        p.setAiReport(j.report);
        const htmlR = buildProjectHtmlReport(p.data, p.language, p.companyName);
        p.setHtmlReport(htmlR);
        p.setViewMode('ai');
      }
    } catch (e) { toast.error(String(e)); }
    finally { p.setGenerating(false); }
  };

  const copyReport = () => {
    const text = p.viewMode === 'source' ? p.report : p.viewMode === 'ai' ? p.aiReport : p.htmlReport;
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const exportHtml = () => {
    if (!p.htmlReport) return;
    const blob = new Blob([`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Project Report</title></head><body>${p.htmlReport}</body></html>`], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${p.data?.project.name ?? 'project'}-report-${new Date().toISOString().slice(0, 10)}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('HTML downloaded');
  };

  const exportTxt = () => {
    if (!p.report) return;
    const blob = new Blob([p.report], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${p.data?.project.name ?? 'project'}-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('TXT downloaded');
  };

  const exportPdf = async () => {
    if (!p.htmlReport) return;
    p.setExporting('pdf');
    try {
      const win = window.open('', '_blank');
      if (win) {
        win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report</title><style>@media print{body{margin:0;padding:0;}}</style></head><body>${p.htmlReport}</body></html>`);
        win.document.close();
        win.focus();
        win.print();
        win.close();
      }
    } finally { p.setExporting(null); }
  };

  const saveApiKey = async () => {
    if (!p.apiKeyInput) return;
    p.setSavingKey(true);
    try {
      await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ anthropic_api_key: p.apiKeyInput }) });
      p.setShowKeyInput(false);
      p.setApiKeyInput('');
      await p.loadConfig();
      toast.success('API key saved');
    } catch { toast.error('Failed to save API key'); }
    finally { p.setSavingKey(false); }
  };

  const savePmEmail = async () => {
    if (!p.pmEmail) return;
    p.setSavingEmail(true);
    try {
      await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ceo_email: p.pmEmail }) });
      toast.success('Email saved');
    } catch { toast.error('Failed to save email'); }
    finally { p.setSavingEmail(false); }
  };

  const openEmailModal = () => {
    if (!p.data) return;
    p.setEmailRecipients(p.pmEmail);
    p.setEmailSubject(`[${p.data.project.name}] Báo cáo tình trạng — ${new Date().toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' })}`);
    p.setGeneratedEmailHtml('');
    p.setSelectedPromptId('executive');
    p.setCustomPromptText('');
    p.setShowEmailModal(true);
  };

  const generateEmail = async () => {
    if (!p.data) return;
    p.setGeneratingEmail(true);
    p.setGeneratedEmailHtml('');
    try {
      const promptTemplate = EMAIL_PROMPT_TEMPLATES.find(t => t.id === p.selectedPromptId);
      const promptInstruction = p.customPromptText || promptTemplate?.text || '';
      const j = await p.generateEmailContent(promptInstruction, p.language);
      if (!j) return;
      if (j.error === 'NO_API_KEY') { toast.error('No Anthropic API key configured'); return; }
      if (j.error) throw new Error(j.error);
      p.setGeneratedEmailHtml(j.emailHtml);
      if (j.subject) p.setEmailSubject(j.subject);
    } catch (e) { toast.error(String(e)); }
    finally { p.setGeneratingEmail(false); }
  };

  const sendEmail = async () => {
    if (!p.generatedEmailHtml || !p.emailRecipients) return;
    p.setSendingEmail(true);
    try {
      const toArr = p.emailRecipients.split(',').map(s => s.trim()).filter(Boolean);
      const htmlBody = wrapEmailDocument(p.generatedEmailHtml, p.companyName, p.data?.project.name ?? '');
      const j = await p.sendEmailViaApi(toArr, p.emailSubject, htmlBody);
      if (j.error) throw new Error(j.error === 'NO_RESEND_KEY' ? 'RESEND_API_KEY not configured' : j.error);
      toast.success(`Email sent to ${toArr.join(', ')}`);
      p.setShowEmailModal(false);
    } catch (e) { toast.error(String(e)); }
    finally { p.setSendingEmail(false); }
  };

  const savePrompt = () => {
    if (!p.savePromptName || !p.customPromptText) return;
    const newPrompt: SavedPrompt = { id: Date.now().toString(), name: p.savePromptName, text: p.customPromptText };
    const updated = [newPrompt, ...p.savedPrompts].slice(0, MAX_SAVED_PROMPTS);
    p.setSavedPrompts(updated);
    localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(updated));
    p.setShowSaveInput(false);
    p.setSavePromptName('');
    toast.success('Prompt saved');
  };

  const deletePrompt = (promptId: string) => {
    const updated = p.savedPrompts.filter(sp => sp.id !== promptId);
    p.setSavedPrompts(updated);
    localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(updated));
  };

  const hasReport = !!(p.htmlReport || p.report || p.aiReport);
  const activeView = p.viewMode === 'preview' ? p.htmlReport : p.viewMode === 'ai' ? mdToHtml(p.aiReport) : '';

  return {
    previewRef, handleGenerate, copyReport, exportHtml, exportTxt, exportPdf,
    saveApiKey, savePmEmail, openEmailModal, generateEmail, sendEmail,
    savePrompt, deletePrompt, hasReport, activeView,
  };
}
