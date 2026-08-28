'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { Badge } from '@/components/ui/badge';
import type { WeeklyRag } from '../shared/types';
import { useWeeklyReportEditor } from './useWeeklyReportEditor';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this page.",
  load_failed: "Couldn't load this page. Try again.",
} as const;

const RAG_BADGE: Record<string, string> = {
  Green: 'bg-green-100 text-green-700',
  Amber: 'bg-amber-100 text-amber-700',
  Red: 'bg-red-100 text-red-700',
  'Not applicable': 'bg-slate-100 text-slate-600',
};

const STATUS_BADGE: Record<string, string> = {
  not_submitted: 'bg-slate-100 text-slate-700',
  draft: 'border border-amber-300 text-amber-700 bg-amber-50',
  submitted: 'bg-green-100 text-green-700',
};

function RagBadge({ rag }: { rag: WeeklyRag | null }) {
  if (!rag) return <span className="text-muted-foreground">—</span>;
  const cls = RAG_BADGE[rag] ?? 'bg-slate-100 text-slate-600';
  return (
    <Badge data-testid="prev-week-rag-badge" className={cls}>
      {rag}
    </Badge>
  );
}

function formatDueAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    });
  } catch {
    return iso;
  }
}

export default function WeeklyReportEditorPage() {
  const params = useParams<{ id?: string; projectId?: string; reportId: string }>();
  const projectId = params.id ?? params.projectId ?? '';
  const reportId = params.reportId;
  const { shell, projectName, loading, error } = useWeeklyReportEditor(projectId, reportId);

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar projectId={projectId} />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading report…</p>
          </div>
        </main>
      </div>
    );
  }

  if (error === 'not_found') {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar projectId={projectId} />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <h1 className="text-base font-semibold">Weekly report not found</h1>
            <p className="text-sm text-slate-600">
              This report may have been removed or you don&apos;t have access.
            </p>
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

  if (!shell) return null;

  const statusCls = STATUS_BADGE[shell.status] ?? 'bg-slate-100 text-slate-700';
  const statusLabel = shell.status.replace(/_/g, ' ');

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar projectId={projectId} />
      <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
        <header className="mb-6 space-y-2">
          <h1 className="text-base font-semibold">Weekly report</h1>
          <p
            className="text-sm text-muted-foreground truncate max-w-xl"
            title={shell.display_name}
          >
            {shell.display_name}
          </p>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            {projectName ? (
              <Link href={`/projects/${projectId}`} className="text-blue-600 hover:underline">
                {projectName}
              </Link>
            ) : null}
            <Badge className={statusCls}>{statusLabel}</Badge>
            <span className="text-muted-foreground">Due {formatDueAt(shell.due_at)} UTC</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-xs font-semibold text-slate-600">Previous week RAG</span>
            <RagBadge rag={shell.prev_week_rag} />
          </div>
        </header>
      </main>
    </div>
  );
}
