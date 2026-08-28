'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ChecklistStatus } from '../shared/types';
import { useProjectChecklist } from './useProjectChecklist';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this page.",
  load_failed: "Couldn't load this page. Try again.",
} as const;

const STATUS_LABEL: Record<ChecklistStatus, string> = {
  none: 'None',
  drafting: 'Drafting',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  not_applicable: 'Not applicable',
};

const STATUS_BADGE: Record<ChecklistStatus, string> = {
  none: 'bg-slate-100 text-slate-700',
  drafting: 'border border-amber-300 text-amber-700 bg-amber-50',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  not_applicable: 'bg-slate-100 text-slate-500',
};

export default function ProjectChecklistPage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id ?? '';
  const { items, projectName, loading, error } = useProjectChecklist(projectId);

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar projectId={projectId} />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading checklist…</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar projectId={projectId} />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-slate-600">{ERROR_COPY[error]}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!items) return null;

  const count = items.length;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar projectId={projectId} />
      <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="p-2 text-sm">
                      <span>{item.catalog_name}</span>
                      {item.catalog_mandatory ? (
                        <Badge className="ml-2 bg-slate-100 text-slate-700 text-xs">Mandatory</Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="p-2 text-sm">{item.catalog_stage}</TableCell>
                    <TableCell className="p-2 text-sm">
                      <Badge className={STATUS_BADGE[item.status]}>
                        {STATUS_LABEL[item.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="p-2 text-sm">
                      {item.confluence_url ? (
                        <a
                          href={item.confluence_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:underline"
                        >
                          Open
                        </a>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
