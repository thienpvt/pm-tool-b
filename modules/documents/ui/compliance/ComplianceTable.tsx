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
import VirtualRows, { ROW_HEIGHT } from '@/modules/weekly/ui/shared/VirtualRows';
import type { ComplianceProject } from '@/modules/documents/ui/shared/types';

const COMPLIANCE_BADGE: Record<string, string> = {
  compliant: 'bg-green-100 text-green-700',
  not_compliant: 'bg-red-100 text-red-700',
  not_applicable: 'bg-slate-100 text-slate-600',
};

const RAG_BADGE: Record<string, string> = {
  green: 'bg-green-100 text-green-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
};

const GRID_HEIGHT = 480;
const COLUMN_COUNT = 6;
const VIRTUAL_THRESHOLD = 100;

function RagBadge({ rag }: { rag: string | null }) {
  if (!rag) return <span className="text-muted-foreground">—</span>;
  const key = rag.toLowerCase();
  const cls = RAG_BADGE[key] ?? 'bg-slate-100 text-slate-600';
  return <Badge className={cls}>{rag}</Badge>;
}

function ComplianceBadge({ compliance }: { compliance: ComplianceProject['compliance'] }) {
  const cls = COMPLIANCE_BADGE[compliance] ?? 'bg-slate-100 text-slate-600';
  return <Badge className={cls}>{compliance}</Badge>;
}

function ComplianceRowCells({ project }: { project: ComplianceProject }) {
  return (
    <>
      <TableCell className="p-2 text-sm max-w-[200px]">
        <Link
          href={`/projects/${project.project_id}/document-checklist`}
          className="text-blue-600 hover:underline truncate inline-block max-w-[200px]"
          title={project.name}
        >
          {project.name}
        </Link>
      </TableCell>
      <TableCell className="p-2 text-sm">{project.project_code ?? '—'}</TableCell>
      <TableCell className="p-2 text-sm">{project.stage ?? '—'}</TableCell>
      <TableCell className="p-2 text-sm">{project.status}</TableCell>
      <TableCell className="p-2 text-sm">
        <RagBadge rag={project.rag} />
      </TableCell>
      <TableCell className="p-2 text-sm">
        <ComplianceBadge compliance={project.compliance} />
      </TableCell>
    </>
  );
}

type ComplianceTableProps = {
  projects: ComplianceProject[];
};

export function ComplianceTable({ projects }: ComplianceTableProps) {
  const useVirtual = projects.length > VIRTUAL_THRESHOLD;

  return (
    <section data-testid="compliance-grid" className="overflow-x-auto">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-white">
          <TableRow>
            <TableHead className="h-8 px-2 text-xs font-semibold">Project</TableHead>
            <TableHead className="h-8 px-2 text-xs font-semibold">Code</TableHead>
            <TableHead className="h-8 px-2 text-xs font-semibold">Stage</TableHead>
            <TableHead className="h-8 px-2 text-xs font-semibold">Status</TableHead>
            <TableHead className="h-8 px-2 text-xs font-semibold">RAG</TableHead>
            <TableHead className="h-8 px-2 text-xs font-semibold">Compliance</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {projects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="p-2 text-sm text-center py-12">
                <p className="font-semibold text-slate-600">No projects match these filters</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Clear filters or adjust criteria to see compliance status.
                </p>
              </TableCell>
            </TableRow>
          ) : useVirtual ? (
            <TableRow>
              <TableCell colSpan={COLUMN_COUNT} className="p-0 border-0">
                <VirtualRows
                  items={projects}
                  height={GRID_HEIGHT}
                  rowHeight={ROW_HEIGHT}
                  rowKey={(project) => project.project_id}
                  renderRow={(project) => (
                    <TableRow data-testid="compliance-row" style={{ height: ROW_HEIGHT }}>
                      <ComplianceRowCells project={project} />
                    </TableRow>
                  )}
                />
              </TableCell>
            </TableRow>
          ) : (
            projects.map((project) => (
              <TableRow key={project.project_id} data-testid="compliance-row">
                <ComplianceRowCells project={project} />
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </section>
  );
}
