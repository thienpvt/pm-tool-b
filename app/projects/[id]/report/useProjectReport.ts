import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { ProjectReportData, SavedPrompt } from './types';
import { SAVED_PROMPTS_KEY } from './types';

export type UseProjectReportParams = {
  projectId: string | undefined;
  reportMode: 'daterange' | 'milestone';
  periodStart: string;
  periodEnd: string;
  selectedMilestoneId: string;
};

export function useProjectReport({
  projectId,
  reportMode,
  periodStart,
  periodEnd,
  selectedMilestoneId,
}: UseProjectReportParams) {
  const [data, setData] = useState<ProjectReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState('');
  const [htmlReport, setHtmlReport] = useState('');
  const [aiReport, setAiReport] = useState('');
  const [apiKeySet, setApiKeySet] = useState<false | 'db' | 'env'>(false);
  const [pmEmail, setPmEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);

  const loadConfig = useCallback(async () => {
    try {
      const r = await fetch('/api/config');
      if (r.ok) {
        const j = await r.json();
        setApiKeySet(j.anthropic_api_key_set === 'env' ? 'env' : j.anthropic_api_key_set === 'true' ? 'db' : false);
        if (j.ceo_email) setPmEmail(j.ceo_email);
      }
      const me = await fetch('/api/auth/me');
      if (me.ok) { const j = await me.json(); if (j.company_name) setCompanyName(j.company_name); }
    } catch {}
  }, []);

  const loadData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      let url = `/api/projects/${projectId}/project-report`;
      if (reportMode === 'daterange') {
        url += `?start=${periodStart}&end=${periodEnd}`;
      } else if (selectedMilestoneId) {
        url += `?milestone_id=${selectedMilestoneId}`;
      }
      const r = await fetch(url);
      if (!r.ok) throw new Error('Failed to load data');
      const d: ProjectReportData = await r.json();
      setData(d);
    } catch (e) { toast.error(String(e)); }
    finally { setLoading(false); }
  }, [projectId, reportMode, periodStart, periodEnd, selectedMilestoneId]);

  const generateAiReport = useCallback(async (language: string) => {
    if (!data || !projectId) return null;
    const r = await fetch(`/api/projects/${projectId}/project-report`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportData: data, language }),
    });
    return r.json();
  }, [data, projectId]);

  const generateEmailContent = useCallback(async (promptInstruction: string, language: string) => {
    if (!data || !projectId) return null;
    const r = await fetch(`/api/projects/${projectId}/project-report/generate-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reportData: data, promptInstruction, language }),
    });
    return r.json();
  }, [data, projectId]);

  const sendEmailViaApi = useCallback(async (to: string[], subject: string, htmlBody: string) => {
    const r = await fetch('/api/portfolio/report/send-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, htmlBody }),
    });
    return r.json();
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_PROMPTS_KEY);
      if (raw) setSavedPrompts(JSON.parse(raw));
    } catch {}
  }, []);

  return {
    data, loading, report, setReport, htmlReport, setHtmlReport, aiReport, setAiReport,
    apiKeySet, pmEmail, setPmEmail, companyName, savedPrompts, setSavedPrompts,
    loadConfig, loadData, generateAiReport, generateEmailContent, sendEmailViaApi,
  };
}
