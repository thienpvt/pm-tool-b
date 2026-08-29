'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CatalogForm } from './CatalogForm';
import { CatalogList } from './CatalogList';
import { TemplatePanel } from './TemplatePanel';
import { useDocumentCatalog } from './useDocumentCatalog';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this page.",
  load_failed: "Couldn't load this page. Try again.",
} as const;

export default function DocumentCatalogPage() {
  const searchParams = useSearchParams();
  const {
    data,
    loading,
    error,
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
    publishTemplate,
    retireTemplate,
  } = useDocumentCatalog();

  const [retireTargetId, setRetireTargetId] = useState<number | null>(null);

  useEffect(() => {
    const catalogIdParam = searchParams.get('catalogId');
    if (catalogIdParam) {
      const id = Number(catalogIdParam);
      if (!Number.isNaN(id)) {
        setSelectedId(id);
      }
    }
  }, [searchParams, setSelectedId]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading document catalog…</p>
          </div>
    </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-slate-600">{ERROR_COPY[error]}</p>
          </div>
    </div>
    );
  }

  if (!data) return null;

  const activeCount = data.filter((row) => row.active).length;
  const editingRow = editingId !== null ? data.find((row) => row.id === editingId) : null;

  const handleConfirmRetire = async () => {
    if (retireTargetId === null) return;
    await retireCatalog(retireTargetId);
    setRetireTargetId(null);
  };

  return (
    <>
        <div className="mb-4">
          <h1 className="text-base font-semibold">Document catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} item{activeCount === 1 ? '' : 's'}
          </p>
        </div>

        <CatalogForm mode="create" saving={creating} onSubmit={createCatalog} />

        {editingRow ? (
          <CatalogForm
            mode="edit"
            initial={editingRow}
            saving={saving || retiring}
            onSubmit={(values) => updateCatalog(editingRow.id, values)}
            onRetire={() => setRetireTargetId(editingRow.id)}
            onCancel={() => setEditingId(null)}
          />
        ) : null}

        <CatalogList
          rows={data}
          selectedId={selectedId}
          onSelectRow={setSelectedId}
          onEditRow={setEditingId}
          onRetireRow={setRetireTargetId}
        />

        {selectedId !== null ? (
          <TemplatePanel
            catalogId={selectedId}
            templates={templates ?? []}
            loading={templatesLoading}
            publishing={publishing}
            retiringTemplateId={retiringTemplateId}
            onPublish={publishTemplate}
            onRetireTemplate={retireTemplate}
          />
        ) : (
          <p className="text-sm text-muted-foreground mt-6">
            Select a catalog item to manage templates.
          </p>
        )}

        <Dialog open={retireTargetId !== null} onOpenChange={(open) => !open && setRetireTargetId(null)}>
          <DialogContent className="max-w-sm" showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Retire this catalog item?</DialogTitle>
              <DialogDescription>
                Existing checklist rows remain; new projects won&apos;t receive this item.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setRetireTargetId(null)}>
                Cancel
              </Button>
              <Button
                className="bg-red-600 text-white hover:bg-red-700"
                disabled={retiring}
                onClick={() => void handleConfirmRetire()}
              >
                Retire item
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </>
  );
}
