'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import VirtualRows, { ROW_HEIGHT } from '../shared/VirtualRows';
import type { PeriodTrackingRow } from '../shared/types';

const RAG_BADGE: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
};

const STATUS_BADGE: Record<string, string> = {
  not_submitted: 'bg-slate-100 text-slate-700',
  draft: 'border border-amber-300 text-amber-700 bg-amber-50',
  submitted: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
};

const GRID_HEIGHT = 400;
const COLUMN_COUNT = 11;

type Props = {
  rows: PeriodTrackingRow[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
};

function RagBadge({ rag }: { rag: string | null }) {
  if (!rag) return <span className="text-muted-foreground">—</span>;
  const key = rag.toLowerCase();
  const cls = RAG_BADGE[key] ?? 'bg-slate-100 text-slate-600';
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return <Badge className={cls}>{label}</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const cls = STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-700';
  const label = status.replace(/_/g, ' ');
  return <Badge className={cls}>{label}</Badge>;
}

export function TrackingGrid({ rows, selectedIds, onSelectionChange }: Props) {
  const eligibleRows = rows.filter((r) => r.status === 'submitted');
  const allEligibleSelected =
    eligibleRows.length > 0 && eligibleRows.every((r) => selectedIds.includes(r.project_id));

  const toggleRow = (projectId: number, checked: boolean) => {
    if (checked) {
      if (!selectedIds.includes(projectId)) {
        onSelectionChange([...selectedIds, projectId]);
      }
    } else {
      onSelectionChange(selectedIds.filter((id) => id !== projectId));
    }
  };

  const toggleAll = (checked: boolean) => {
    if (checked) {
      const next = [...selectedIds];
      for (const row of eligibleRows) {
        if (!next.includes(row.project_id)) {
          next.push(row.project_id);
        }
      }
      onSelectionChange(next);
    } else {
      const eligibleSet = new Set(eligibleRows.map((r) => r.project_id));
      onSelectionChange(selectedIds.filter((id) => !eligibleSet.has(id)));
    }
  };

  return (
    <section data-testid="tracking-grid" className="overflow-x-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-white">
          <TableRow>
            <TableHead className="h-8 px-2 text-xs w-10">
              <input
                type="checkbox"
                aria-label="Select all submitted"
                className="h-4 w-4"
                checked={allEligibleSelected}
                disabled={eligibleRows.length === 0}
                onChange={(e) => toggleAll(e.target.checked)}
              />
            </TableHead>
            <TableHead className="h-8 px-2 text-xs">Project</TableHead>
            <TableHead className="h-8 px-2 text-xs">Code</TableHead>
            <TableHead className="h-8 px-2 text-xs">Stage</TableHead>
            <TableHead className="h-8 px-2 text-xs">PM</TableHead>
            <TableHead className="h-8 px-2 text-xs">Status</TableHead>
            <TableHead className="h-8 px-2 text-xs">Overdue</TableHead>
            <TableHead className="h-8 px-2 text-xs">RAG</TableHead>
            <TableHead className="h-8 px-2 text-xs">Lateness</TableHead>
            <TableHead className="h-8 px-2 text-xs">Tech council</TableHead>
            <TableHead className="h-8 px-2 text-xs">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="p-2 text-sm text-center py-12">
                <p className="font-semibold text-slate-600">No projects in this period</p>
                <p className="text-sm text-muted-foreground mt-1">
                  This period has no obligated weekly reports, or filters exclude all rows.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="p-0 border-0">
                <VirtualRows
                  items={rows}
                  height={GRID_HEIGHT}
                  rowHeight={ROW_HEIGHT}
                  overscan={5}
                  rowKey={(row) => row.project_id}
                  renderRow={(row) => (
                    <div
                      data-testid="virtual-row"
                      className="flex items-center border-b text-sm"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div className="w-10 shrink-0 px-2 flex items-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          aria-label={`Select ${row.name}`}
                          disabled={row.status !== 'submitted'}
                          checked={selectedIds.includes(row.project_id)}
                          onChange={(e) => toggleRow(row.project_id, e.target.checked)}
                        />
                      </div>
                      <div className="min-w-[140px] max-w-[200px] px-2 truncate" title={row.name}>
                        <Link
                          href={`/projects/${row.project_id}`}
                          className="text-blue-600 hover:underline truncate inline-block max-w-[200px]"
                        >
                          {row.name}
                        </Link>
                      </div>
                      <div className="w-16 shrink-0 px-2">{row.project_code ?? '—'}</div>
                      <div className="w-12 shrink-0 px-2">{row.stage ?? '—'}</div>
                      <div className="w-24 shrink-0 px-2 truncate">{row.pm_display_name ?? '—'}</div>
                      <div className="w-24 shrink-0 px-2">
                        <StatusBadge status={row.status} />
                      </div>
                      <div className="w-16 shrink-0 px-2">
                        {row.overdue ? (
                          <Badge className="bg-red-100 text-red-700">Yes</Badge>
                        ) : (
                          <span className="text-muted-foreground">No</span>
                        )}
                      </div>
                      <div className="w-16 shrink-0 px-2">
                        <RagBadge rag={row.rag} />
                      </div>
                      <div className="w-16 shrink-0 px-2">{row.first_lateness ?? '—'}</div>
                      <div className="w-16 shrink-0 px-2">
                        {row.has_technology_council_issues ? 'Yes' : '—'}
                      </div>
                      <div className="w-24 shrink-0 px-2">
                        {row.report_id > 0 ? (
                          <Link
                            href={`/projects/${row.project_id}/weekly-reports/${row.report_id}`}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Open report
                          </Link>
                        ) : (
                          '—'
                        )}
                      </div>
                    </div>
                  )}
                />
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </section>
  );
}
