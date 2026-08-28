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
import type { PortfolioDashboardListRow } from '@/modules/dashboards/ui/shared/types';

const RAG_BADGE: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
};

const COLUMN_COUNT = 8;

type Props = {
  list: PortfolioDashboardListRow[];
};

function RagBadgeCell({ rag }: { rag: string | null }) {
  if (!rag) return <span className="text-muted-foreground">—</span>;
  const key = rag.toLowerCase();
  const cls = RAG_BADGE[key] ?? 'bg-slate-100 text-slate-700';
  const label = key.charAt(0).toUpperCase() + key.slice(1);
  return <Badge className={cls}>{label}</Badge>;
}

export function PortfolioProjectTable({ list }: Props) {
  return (
    <section data-testid="portfolio-project-list" className="mt-6">
      <h2 className="text-base font-semibold mb-2">Projects</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="h-8 px-2 text-xs">Name</TableHead>
            <TableHead className="h-8 px-2 text-xs">Code</TableHead>
            <TableHead className="h-8 px-2 text-xs">Program</TableHead>
            <TableHead className="h-8 px-2 text-xs">Stage</TableHead>
            <TableHead className="h-8 px-2 text-xs">Status</TableHead>
            <TableHead className="h-8 px-2 text-xs">RAG</TableHead>
            <TableHead className="h-8 px-2 text-xs">PM</TableHead>
            <TableHead className="h-8 px-2 text-xs">Progress %</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="p-2 text-sm text-center py-12">
                <p className="font-medium text-slate-600">No projects match these filters</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Adjust or clear filters to see projects in the portfolio.
                </p>
              </TableCell>
            </TableRow>
          ) : (
            list.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="p-2 text-sm">
                  <Link
                    href={`/projects/${row.id}`}
                    className="text-blue-600 hover:underline truncate max-w-[200px] inline-block"
                    title={row.name}
                  >
                    {row.name}
                  </Link>
                </TableCell>
                <TableCell className="p-2 text-sm">{row.project_code ?? '—'}</TableCell>
                <TableCell className="p-2 text-sm">{row.program_name ?? '—'}</TableCell>
                <TableCell className="p-2 text-sm">{row.stage ?? '—'}</TableCell>
                <TableCell className="p-2 text-sm">{row.status}</TableCell>
                <TableCell className="p-2 text-sm">
                  <RagBadgeCell rag={row.rag} />
                </TableCell>
                <TableCell className="p-2 text-sm">{row.pm_name ?? '—'}</TableCell>
                <TableCell className="p-2 text-sm">
                  {row.progress_pct != null ? `${row.progress_pct}%` : '—'}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}
