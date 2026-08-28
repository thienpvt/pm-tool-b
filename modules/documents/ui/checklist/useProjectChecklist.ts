'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { ChecklistItem } from '../shared/types';

export type ChecklistLoadError = 'unauthorized' | 'forbidden' | 'load_failed';

export type PatchItemResult =
  | { ok: true }
  | { ok: false; message: string; field?: string };

export function useProjectChecklist(projectId: string) {
  const [items, setItems] = useState<ChecklistItem[] | null>(null);
  const [projectName, setProjectName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ChecklistLoadError | null>(null);
  const [savingId, setSavingId] = useState<number | null>(null);
  const loadSeqRef = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++loadSeqRef.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/document-checklist`);

      if (requestId !== loadSeqRef.current) return;
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
      if (requestId !== loadSeqRef.current) return;
      setItems(loaded);
      setError(null);

      const projectRes = await fetch(`/api/projects/${projectId}`);
      if (requestId !== loadSeqRef.current) return;
      if (projectRes.ok) {
        const project = (await projectRes.json()) as { name?: string };
        if (requestId !== loadSeqRef.current) return;
        setProjectName(project.name ?? null);
      }
    } catch {
      if (requestId !== loadSeqRef.current) return;
      setError('load_failed');
      setItems(null);
    } finally {
      if (requestId === loadSeqRef.current) setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const patchItem = useCallback(
    async (itemId: number, body: Record<string, unknown>): Promise<PatchItemResult> => {
      setSavingId(itemId);
      try {
        const res = await fetch(`/api/projects/${projectId}/document-checklist/${itemId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (res.status === 400) {
          const data = (await res.json()) as { error?: string; field?: string };
          toast.error('Fix the highlighted field and try again.');
          return {
            ok: false,
            field: data.field,
            message: data.error ?? 'Validation error',
          };
        }

        if (!res.ok) {
          toast.error("Couldn't save checklist item — try again.");
          return { ok: false, message: 'save failed' };
        }

        toast.success('Checklist item saved');
        await load();
        return { ok: true };
      } catch {
        toast.error("Couldn't save checklist item — try again.");
        return { ok: false, message: 'network error' };
      } finally {
        setSavingId(null);
      }
    },
    [projectId, load],
  );

  return {
    items,
    projectName,
    loading,
    error,
    reload: load,
    patchItem,
    savingId,
  };
}
