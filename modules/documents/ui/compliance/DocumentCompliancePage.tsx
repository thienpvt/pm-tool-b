'use client';

import { AlertTriangle } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { useDocumentCompliance } from './useDocumentCompliance';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this page.",
  load_failed: "Couldn't load this page. Try again.",
} as const;

export default function DocumentCompliancePage() {
  const { data, loading, error } = useDocumentCompliance();

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading compliance…</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-slate-600">{ERROR_COPY[error]}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!data) return null;

  const count = data.projects.length;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
        <div className="mb-4">
          <h1 className="text-base font-semibold">Document compliance</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count} project{count === 1 ? '' : 's'} matching filters
          </p>
        </div>
        <div data-testid="compliance-project-list">
          {data.projects.map((project) => (
            <div key={project.project_id}>{project.name}</div>
          ))}
        </div>
      </main>
    </div>
  );
}
