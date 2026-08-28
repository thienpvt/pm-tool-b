'use client';

import { useCallback, useEffect, useState } from 'react';
import type { WeeklyReportEditorShell } from '../shared/types';

export type WeeklyReportError = 'unauthorized' | 'forbidden' | 'not_found' | 'load_failed';

export function useWeeklyReportEditor(projectId: string, reportId: string) {
  const [shell, setShell] = useState<WeeklyReportEditorShell | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WeeklyReportError | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const reportRes = await fetch(`/api/projects/${projectId}/weekly-reports/${reportId}`);

      if (reportRes.status === 401) {
        setError('unauthorized');
        setShell(null);
        return;
      }
      if (reportRes.status === 403) {
        setError('forbidden');
        setShell(null);
        return;
      }
      if (reportRes.status === 404) {
        setError('not_found');
        setShell(null);
        return;
      }
      if (!reportRes.ok) {
        setError('load_failed');
        setShell(null);
        return;
      }

      const loadedShell = (await reportRes.json()) as WeeklyReportEditorShell;
      setShell(loadedShell);
      setError(null);

      const projectRes = await fetch(`/api/projects/${projectId}`);
      if (projectRes.ok) {
        const project = (await projectRes.json()) as { name?: string };
        setProjectName(project.name ?? null);
      }
    } catch {
      setError('load_failed');
      setShell(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, reportId]);

  useEffect(() => {
    load();
  }, [load]);

  const editable =
    shell !== null && (shell.status !== 'submitted' || shell.correction_open);

  return {
    shell,
    projectName,
    loading,
    error,
    editable,
    load,
  };
}
