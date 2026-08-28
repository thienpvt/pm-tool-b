'use client';

import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useWeeklyPeriods } from './useWeeklyPeriods';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this page.",
  load_failed: "Couldn't load this page. Try again.",
} as const;

const COLUMN_COUNT = 4;

function formatDueAtUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

export default function WeeklyPeriodsPage() {
  const { data, loading, error } = useWeeklyPeriods();

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading weekly periods…</p>
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

  const count = data.length;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
        <div className="mb-4">
          <h1 className="text-base font-semibold">Weekly periods</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count} period{count === 1 ? '' : 's'}
          </p>
        </div>

        <div className="overflow-x-auto" data-testid="weekly-period-list-wrapper">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 px-2 text-xs">Week</TableHead>
                <TableHead className="h-8 px-2 text-xs">ISO week</TableHead>
                <TableHead className="h-8 px-2 text-xs">Due at</TableHead>
                <TableHead className="h-8 px-2 text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMN_COUNT} className="p-2 text-sm text-center py-12">
                    <p className="font-semibold text-slate-600">No weekly periods yet</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Create the first period for your company using an ISO week above.
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((period) => (
                  <TableRow key={period.id}>
                    <TableCell className="p-2 text-sm">
                      <span
                        className="truncate max-w-[240px] inline-block"
                        title={period.display_name}
                      >
                        {period.display_name}
                      </span>
                    </TableCell>
                    <TableCell className="p-2 text-sm">{period.iso_week}</TableCell>
                    <TableCell className="p-2 text-sm">{formatDueAtUtc(period.due_at)}</TableCell>
                    <TableCell className="p-2 text-sm">
                      <Link
                        href={`/weekly/tracking?periodId=${period.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        Track submissions
                      </Link>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
