'use client';

import { AlertTriangle } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { PmActionQueues } from './PmActionQueues';
import { usePmDashboard } from './usePmDashboard';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this dashboard.",
  load_failed: "Couldn't load the dashboard. Try again.",
} as const;

export default function PmDashboardPage() {
  const { data, loading, error } = usePmDashboard();

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading dashboard…</p>
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

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
        <h1 className="text-base font-semibold mb-4">My dashboard</h1>
        <PmActionQueues projects={data.projects} actions={data.actions} />
      </main>
    </div>
  );
}
