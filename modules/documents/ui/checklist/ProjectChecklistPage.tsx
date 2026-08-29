'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ChecklistItemRow } from './ChecklistItemRow';
import { useProjectChecklist } from './useProjectChecklist';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this page.",
  load_failed: "Couldn't load this page. Try again.",
} as const;

export default function ProjectChecklistPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id ?? '';
  const { items, projectName, loading, error, patchItem, savingId } = useProjectChecklist(projectId);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center min-h-[50vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading checklist…</p>
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

  if (!items) return null;

  const count = items.length;

  return (
    <>
        <div className="mb-4">
          <h1 className="text-base font-semibold">Document checklist</h1>
          {projectName ? (
            <p className="text-sm text-muted-foreground mt-1">
              <Link href={`/projects/${projectId}`} className="text-blue-600 hover:underline">
                {projectName}
              </Link>
              {' · '}
              {count} item{count === 1 ? '' : 's'}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              {count} item{count === 1 ? '' : 's'}
            </p>
          )}
        </div>

        {count === 0 ? (
          <div className="text-center py-12">
            <h2 className="text-base font-semibold">No checklist items yet</h2>
            <p className="text-sm text-muted-foreground mt-2">
              Checklist rows appear when the project stage matches catalog items.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto" data-testid="checklist-table">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="h-8 px-2 text-xs font-semibold">Document</TableHead>
                  <TableHead className="h-8 px-2 text-xs font-semibold">Stage</TableHead>
                  <TableHead className="h-8 px-2 text-xs font-semibold">Status</TableHead>
                  <TableHead className="h-8 px-2 text-xs font-semibold">Confluence</TableHead>
                  <TableHead className="h-8 px-2 text-xs font-semibold">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <ChecklistItemRow
                    key={item.id}
                    item={item}
                    saving={savingId === item.id}
                    onSave={patchItem}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
    </>
  );
}
