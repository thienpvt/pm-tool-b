'use client';

import { useState, Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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

function JsonPanel({ value }: { value: unknown }) {
  return (
    <pre className="text-xs font-mono whitespace-pre-wrap overflow-auto max-h-60 bg-slate-50 p-2 rounded border">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

function AuditRowDetail({ row }: { row: AuditLogRow }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-2 bg-slate-50/50">
      <div>
        <p className="text-xs font-semibold mb-1">Before</p>
        <JsonPanel value={row.before} />
      </div>
      <div>
        <p className="text-xs font-semibold mb-1">After</p>
        <JsonPanel value={row.after} />
      </div>
    </div>
  );
}

type AuditTableProps = {
  rows: AuditLogRow[];
  expandedId?: number | null;
  onToggleExpand?: (id: number | null) => void;
};

export function AuditTable({ rows, expandedId: controlledExpandedId, onToggleExpand }: AuditTableProps) {
  const [internalExpandedId, setInternalExpandedId] = useState<number | null>(null);
  const expandedId = controlledExpandedId !== undefined ? controlledExpandedId : internalExpandedId;

  const toggleExpand = (id: number) => {
    const next = expandedId === id ? null : id;
    if (onToggleExpand) {
      onToggleExpand(next);
    } else {
      setInternalExpandedId(next);
    }
  };

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
            rows.map((row) => {
              const isExpanded = expandedId === row.id;
              return (
                <Fragment key={row.id}>
                  <TableRow data-testid="audit-row">
                    <TableCell className="p-2 text-sm">
                      {new Date(row.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="p-2 text-sm">{row.actor_id}</TableCell>
                    <TableCell className="p-2 text-sm">
                      {row.entity_type} #{row.entity_id}
                    </TableCell>
                    <TableCell className="p-2 text-xs font-mono">{row.action}</TableCell>
                    <TableCell className="p-2 text-sm">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        aria-label="Show audit details"
                        aria-expanded={isExpanded}
                        onClick={() => toggleExpand(row.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                  {isExpanded ? (
                    <TableRow>
                      <TableCell colSpan={COLUMN_COUNT} className="p-0 border-b">
                        <AuditRowDetail row={row} />
                      </TableCell>
                    </TableRow>
                  ) : null}
                </Fragment>
              );
            })
          )}
        </TableBody>
      </Table>
    </section>
  );
}
