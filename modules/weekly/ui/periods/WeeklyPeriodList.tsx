'use client';

import Link from 'next/link';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WeeklyPeriodListItem } from '../shared/types';

const COLUMN_COUNT = 4;

function formatDueAtUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
}

type Props = {
  periods: WeeklyPeriodListItem[];
};

export function WeeklyPeriodList({ periods }: Props) {
  return (
    <section data-testid="weekly-period-list" className="mt-6">
      <div className="overflow-x-auto">
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
            {periods.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="p-2 text-sm text-center py-12">
                  <p className="font-semibold text-slate-600">No weekly periods yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Create the first period for your company using an ISO week above.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              periods.map((period) => (
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
    </section>
  );
}
