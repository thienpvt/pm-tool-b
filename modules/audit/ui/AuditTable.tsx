'use client';

import { useState, Fragment } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AuditLogRow } from '@/modules/documents/ui/shared/types';
import VirtualRows, { ROW_HEIGHT } from '@/modules/weekly/ui/shared/VirtualRows';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const COLUMN_COUNT = 5;
const GRID_HEIGHT = 480;
const VIRTUAL_THRESHOLD = 100;

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
};

export function AuditTable({ rows }: AuditTableProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const useVirtual = rows.length > VIRTUAL_THRESHOLD && expandedId === null;

  const toggleExpand = (id: number) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const renderCollapsedCells = (row: AuditLogRow, isExpanded: boolean) => (
    <>
      <TableCell className="p-2 text-sm">{new Date(row.created_at).toLocaleString()}</TableCell>
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
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </Button>
      </TableCell>
    </>
  );

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
          ) : useVirtual ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="p-0 border-0">
                <VirtualRows
                  items={rows}
                  height={GRID_HEIGHT}
                  rowHeight={ROW_HEIGHT}
                  rowKey={(row) => row.id}
                  renderRow={(row) => (
                    <TableRow data-testid="audit-row" style={{ height: ROW_HEIGHT }}>
                      {renderCollapsedCells(row, false)}
                    </TableRow>
                  )}
                />
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const isExpanded = expandedId === row.id;
              return (
                <Fragment key={row.id}>
                  <TableRow data-testid="audit-row">
                    {renderCollapsedCells(row, isExpanded)}
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
