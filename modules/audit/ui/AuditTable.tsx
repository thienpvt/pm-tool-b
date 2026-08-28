'use client';

import type { AuditLogRow } from '@/modules/documents/ui/shared/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const COLUMN_COUNT = 5;

type AuditTableProps = {
  rows: AuditLogRow[];
};

export function AuditTable({ rows }: AuditTableProps) {
  return (
    <section data-testid="audit-table" className="overflow-x-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-white">
          <TableRow>
            <TableHead className="h-8 px-2 text-xs font-semibold">Time</TableHead>
            <TableHead className="h-8 px-2 text-xs font-semibold">Actor</TableHead>
            <TableHead className="h-8 px-2 text-xs font-semibold">Entity</TableHead>
            <TableHead className="h-8 px-2 text-xs font-semibold">Action</TableHead>
            <TableHead className="h-8 px-2 text-xs font-semibold">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="p-2 text-sm text-center py-12">
                <p className="font-semibold text-slate-600">No audit entries found</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Broaden the date range or clear entity filters.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id} data-testid="audit-row">
                <TableCell className="p-2 text-sm">
                  {new Date(row.created_at).toLocaleString()}
                </TableCell>
                <TableCell className="p-2 text-sm">{row.actor_id}</TableCell>
                <TableCell className="p-2 text-sm">
                  {row.entity_type} #{row.entity_id}
                </TableCell>
                <TableCell className="p-2 text-xs font-mono">{row.action}</TableCell>
                <TableCell className="p-2 text-sm" />
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}
