import { useCallback, useEffect, useState } from 'react';
import type { MeUser, PortfolioData } from './types';

export function usePortfolioDashboard() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [companyName, setCompanyName] = useState('');
  const [meUser, setMeUser] = useState<MeUser | null>(null);

  const loadPortfolio = useCallback(() => {
    setLoading(true);
    fetch('/api/portfolio').then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  useEffect(() => {
    loadPortfolio();
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(u => {
      if (u?.company_name) setCompanyName(u.company_name);
      if (u) setMeUser(u);
    });
  }, [loadPortfolio]);

  return { data, loading, companyName, meUser, setMeUser, refetch: loadPortfolio };
}
