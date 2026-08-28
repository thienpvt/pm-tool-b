'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChecklistItem } from '../shared/types';

export type ChecklistLoadError = 'unauthorized' | 'forbidden' | 'load_failed';

export function useProjectChecklist(projectId: string) {
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ChecklistLoadError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/document-checklist`);

      if (res.status === 401) {
        setError('unauthorized');
        setItems(null);
        return;
      }
      if (res.status === 403) {
        setError('forbidden');
        setItems(null);
        return;
      }
      if (res.status === 404) {
        setError('load_failed');
        setItems(null);
        return;
      }
      if (!res.ok) {
        setError('load_failed');
        setItems(null);
        return;
      }

      const loaded = (await res.json()) as ChecklistItem[];
      setItems(loaded);
      setError(null);

      const projectRes = await fetch(`/api/projects/${projectId}`);
      if (projectRes.ok) {
        const project = (await projectRes.json()) as { name?: string };
        setProjectName(project.name ?? null);
      }
    } catch {
      setError('load_failed');
      setItems(null);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  return { items, projectName, loading, error, reload: load };
}
