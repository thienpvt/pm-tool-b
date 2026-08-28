'use client';

import { useCallback, useEffect, useState } from 'react';
import type { CatalogRow } from '../shared/types';

export type DocumentCatalogError = 'unauthorized' | 'forbidden' | 'load_failed';

export function useDocumentCatalog() {
  const [data, setData] = useState<CatalogRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DocumentCatalogError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/document-catalog');

      if (res.status === 401) {
        setError('unauthorized');
        setData(null);
        return;
      }
      if (res.status === 403) {
        setError('forbidden');
        setData(null);
        return;
      }
      if (!res.ok) {
        setError('load_failed');
        setData(null);
        return;
      }

      const rows = (await res.json()) as CatalogRow[];
      setData(rows);
      setError(null);
    } catch {
      setError('load_failed');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, load };
}
