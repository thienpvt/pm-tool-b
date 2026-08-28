import { useCallback, useEffect, useState } from 'react';
import type { PortfolioReportData } from './types';

export type UsePortfolioReportParams = {
  reportMode: 'daterange' | 'milestone';
  selectedMilestoneIds: Set<number>;
  periodStart: string;
  periodEnd: string;
};

export function usePortfolioReport({ reportMode, selectedMilestoneIds, periodStart, periodEnd }: UsePortfolioReportParams) {
  const [data, setData] = useState<PortfolioReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState('');
  const [htmlReport, setHtmlReport] = useState('');
  const [apiKeySet, setApiKeySet] = useState<false | 'db' | 'env'>(false);
  const [ceoEmail, setCeoEmail] = useState('');
  const [companyName, setCompanyName] = useState('');

  const loadConfig = useCallback(async () => {
    const res = await fetch('/api/config');
    const d = await res.json();
    if (d.anthropic_api_key_set === 'env') setApiKeySet('env');
    else if (d.anthropic_api_key_set === 'true') setApiKeySet('db');
    else setApiKeySet(false);
    if (d.ceo_email) setCeoEmail(d.ceo_email);
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const url = reportMode === 'milestone' && selectedMilestoneIds.size > 0
        ? `/api/portfolio/report?milestone_ids=${[...selectedMilestoneIds].join(',')}`
        : `/api/portfolio/report?start=${periodStart}&end=${periodEnd}`;
      const res = await fetch(url);
      const d = await res.json();
      setData(d);
      setReport(''); setHtmlReport('');
    } finally {
      setLoading(false);
    }
  }, [reportMode, selectedMilestoneIds, periodStart, periodEnd]);

  useEffect(() => { loadConfig(); }, [loadConfig]);
  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(d => { if (d?.company_name) setCompanyName(d.company_name); });
  }, []);

  return {
    data, loading, report, setReport, htmlReport, setHtmlReport,
    apiKeySet, ceoEmail, setCeoEmail, companyName,
    loadConfig, loadData,
  };
}
