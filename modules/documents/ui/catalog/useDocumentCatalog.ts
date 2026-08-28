'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { CatalogRow, TemplateRow } from '../shared/types';
import type { CatalogFormValues } from './CatalogForm';

export type DocumentCatalogError = 'unauthorized' | 'forbidden' | 'load_failed';

export function useDocumentCatalog() {
  const [data, setData] = useState<CatalogRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<DocumentCatalogError | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [retiringTemplateId, setRetiringTemplateId] = useState<number | null>(null);

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

  const loadTemplates = useCallback(async (catalogId: number) => {
    setTemplatesLoading(true);
    try {
      const res = await fetch(`/api/document-templates?catalog_id=${catalogId}`);
      if (!res.ok) {
        setTemplates([]);
        return;
      }
      const rows = (await res.json()) as TemplateRow[];
      setTemplates(rows);
    } catch {
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selectedId !== null) {
      void loadTemplates(selectedId);
    } else {
      setTemplates(null);
    }
  }, [selectedId, loadTemplates]);

  const createCatalog = useCallback(
    async (values: CatalogFormValues) => {
      setCreating(true);
      try {
        const res = await fetch('/api/document-catalog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            purpose: values.purpose || undefined,
            stage: values.stage,
            mandatory: values.mandatory,
            apply_to_in_flight: values.apply_to_in_flight,
          }),
        });
        if (!res.ok) {
          toast.error("Couldn't add catalog item. Check the fields and try again.");
          return;
        }
        toast.success('Catalog item added');
        await load();
      } catch {
        toast.error("Couldn't add catalog item. Check the fields and try again.");
      } finally {
        setCreating(false);
      }
    },
    [load],
  );

  const updateCatalog = useCallback(
    async (id: number, values: CatalogFormValues) => {
      setSaving(true);
      try {
        const res = await fetch(`/api/document-catalog/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: values.name,
            purpose: values.purpose || undefined,
            stage: values.stage,
            mandatory: values.mandatory,
            active: values.active,
            apply_to_in_flight: values.apply_to_in_flight,
          }),
        });
        if (!res.ok) {
          toast.error("Couldn't save catalog item — try again.");
          return;
        }
        toast.success('Catalog item saved');
        setEditingId(null);
        await load();
      } catch {
        toast.error("Couldn't save catalog item — try again.");
      } finally {
        setSaving(false);
      }
    },
    [load],
  );

  const retireCatalog = useCallback(
    async (id: number) => {
      setRetiring(true);
      try {
        const res = await fetch(`/api/document-catalog/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: false }),
        });
        if (!res.ok) {
          toast.error("Couldn't save catalog item — try again.");
          return;
        }
        toast.success('Catalog item retired');
        setEditingId(null);
        await load();
      } catch {
        toast.error("Couldn't save catalog item — try again.");
      } finally {
        setRetiring(false);
      }
    },
    [load],
  );

  const publishTemplate = useCallback(
    async (payload: {
      catalog_id: number;
      name: string;
      document_type: string;
      effective_date: string;
      guidance?: string;
      template_url: string;
    }) => {
      setPublishing(true);
      try {
        const res = await fetch('/api/document-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
          if (errBody.field === 'template_url') {
            return { ok: false as const, field: 'template_url' as const, message: errBody.error ?? 'Invalid URL' };
          }
          toast.error("Couldn't publish template — try again.");
          return { ok: false as const };
        }
        toast.success('Template published');
        await loadTemplates(payload.catalog_id);
        return { ok: true as const };
      } catch {
        toast.error("Couldn't publish template — try again.");
        return { ok: false as const };
      } finally {
        setPublishing(false);
      }
    },
    [loadTemplates],
  );

  const retireTemplate = useCallback(
    async (templateId: number, catalogId: number) => {
      setRetiringTemplateId(templateId);
      try {
        const res = await fetch(`/api/document-templates/${templateId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ retire: true }),
        });
        if (!res.ok) {
          toast.error("Couldn't retire template — try again.");
          return;
        }
        toast.success('Template retired');
        await loadTemplates(catalogId);
      } catch {
        toast.error("Couldn't retire template — try again.");
      } finally {
        setRetiringTemplateId(null);
      }
    },
    [loadTemplates],
  );

  return {
    data,
    loading,
    error,
    load,
    creating,
    saving,
    retiring,
    createCatalog,
    updateCatalog,
    retireCatalog,
    selectedId,
    setSelectedId,
    editingId,
    setEditingId,
    templates,
    templatesLoading,
    publishing,
    retiringTemplateId,
    loadTemplates,
    publishTemplate,
    retireTemplate,
  };
}
