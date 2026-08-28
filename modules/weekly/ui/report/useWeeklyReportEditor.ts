'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { WeeklyReportEditorShell, WeeklyRag } from '../shared/types';

export type WeeklyReportError = 'unauthorized' | 'forbidden' | 'not_found' | 'load_failed';

type PatchKey =
  | 'highlights'
  | 'completed_work'
  | 'next_week_goals'
  | 'nearest_milestone'
  | 'nearest_milestone_id'
  | 'raid_dependency'
  | 'leadership_support'
  | 'this_week_rag';

export function useWeeklyReportEditor(projectId: string, reportId: string) {
  const [shell, setShell] = useState<WeeklyReportEditorShell | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<WeeklyReportError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [correcting, setCorrecting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPatchRef = useRef<Partial<Record<PatchKey, unknown>>>({});

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

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const editable =
    shell !== null && (shell.status !== 'submitted' || shell.correction_open);

  const flushPatch = useCallback(async () => {
    const body = { ...pendingPatchRef.current };
    pendingPatchRef.current = {};
    if (Object.keys(body).length === 0) return;

    try {
      const res = await fetch(`/api/projects/${projectId}/weekly-reports/${reportId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.status === 409) {
        toast.error('Report is submitted — open a correction to edit.');
        return;
      }
      if (!res.ok) {
        toast.error("Couldn't save draft — try again.");
        return;
      }

      const updated = (await res.json()) as WeeklyReportEditorShell;
      setShell(updated);
    } catch {
      toast.error("Couldn't save draft — try again.");
    }
  }, [projectId, reportId]);

  const patchField = useCallback(
    (partial: Partial<Record<PatchKey, unknown>>) => {
      if (!editable) return;

      setShell((prev) => (prev ? { ...prev, ...partial } : prev));
      Object.assign(pendingPatchRef.current, partial);

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void flushPatch();
      }, 300);
    },
    [editable, flushPatch],
  );

  const submitReport = useCallback(async () => {
    setSubmitting(true);
    setFieldErrors([]);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/weekly-reports/${reportId}/submit`,
        { method: 'POST' },
      );

      if (res.status === 400) {
        const body = (await res.json()) as { error?: string; fields?: string[] };
        setFieldErrors(body.fields ?? []);
        toast.error('Fix validation errors before submitting.');
        return;
      }
      if (!res.ok) {
        toast.error("Couldn't load this page. Try again.");
        return;
      }

      toast.success('Report submitted');
      await load();
    } catch {
      toast.error("Couldn't load this page. Try again.");
    } finally {
      setSubmitting(false);
    }
  }, [projectId, reportId, load]);

  const correctReport = useCallback(async () => {
    setCorrecting(true);
    try {
      const res = await fetch(
        `/api/projects/${projectId}/weekly-reports/${reportId}/correct`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );

      if (!res.ok) {
        toast.error("Couldn't load this page. Try again.");
        return;
      }

      toast.success('Correction opened — you can edit the report.');
      await load();
    } catch {
      toast.error("Couldn't load this page. Try again.");
    } finally {
      setCorrecting(false);
    }
  }, [projectId, reportId, load]);

  return {
    shell,
    projectName,
    loading,
    error,
    editable,
    fieldErrors,
    submitting,
    correcting,
    load,
    patchField,
    submitReport,
    correctReport,
  };
}

export const RAG_OPTIONS: WeeklyRag[] = ['Green', 'Amber', 'Red', 'Not applicable'];

export function fieldHasError(fieldErrors: string[], path: string): boolean {
  return fieldErrors.includes(path);
}
