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
import type { PortfolioDashboardPayload } from '@/modules/dashboards/ui/shared/types';
import type { PortfolioDrilldownKey } from './PortfolioKpiTiles';

const PANEL_TITLES: Record<PortfolioDrilldownKey, string> = {
  overdue_milestones: 'Overdue milestones',
  high_raid: 'High open RAID',
  technology_council: 'Technology council',
};

type DrilldownRow = Record<string, unknown>;

type Props = {
  activeKey: PortfolioDrilldownKey | null;
  drilldowns: PortfolioDashboardPayload['drilldowns'];
};

function overdueLink(row: DrilldownRow): string | null {
  const projectId = row.project_id;
  if (projectId == null) return null;
  return `/projects/${projectId}/milestones`;
}

function raidLink(row: DrilldownRow): string | null {
  const projectId = row.project_id;
  if (projectId == null) return null;
  return `/projects/${projectId}/raid`;
}

function OverdueRows({ rows }: { rows: DrilldownRow[] }) {
  return (
    <>
      {rows.map((row, i) => {
        const name = String(row.name ?? '');
        const projectName = String(row.project_name ?? '');
        const href = overdueLink(row);
        return (
          <TableRow key={String(row.id ?? row.milestone_id ?? i)}>
            <TableCell className="p-2 text-sm">
              {href ? (
                <Link
                  href={href}
                  className="text-blue-600 hover:underline truncate max-w-[200px] inline-block"
                  title={name}
                >
                  {name}
                </Link>
              ) : (
                <span className="truncate max-w-[200px] inline-block" title={name}>
                  {name}
                </span>
              )}
            </TableCell>
            <TableCell className="p-2 text-sm">{projectName}</TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

function HighRaidRows({ rows }: { rows: DrilldownRow[] }) {
  return (
    <>
      {rows.map((row, i) => {
        const code = String(row.code ?? row.id ?? '');
        const entityType = String(row.entity_type ?? '');
        const href = raidLink(row);
        return (
          <TableRow key={String(row.id ?? i)}>
            <TableCell className="p-2 text-sm">
              {href ? (
                <Link href={href} className="text-blue-600 hover:underline">
                  {code}
                </Link>
              ) : (
                code
              )}
            </TableCell>
            <TableCell className="p-2 text-sm">{entityType}</TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

function TechCouncilRows({ rows }: { rows: DrilldownRow[] }) {
  return (
    <>
      {rows.map((row, i) => {
        const id = row.id;
        const href = raidLink(row);
        return (
          <TableRow key={String(id ?? i)}>
            <TableCell className="p-2 text-sm">
              {href ? (
                <Link href={href} className="text-blue-600 hover:underline">
                  Issue #{String(id)}
                </Link>
              ) : (
                `Issue #${String(id)}`
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

export function PortfolioDrilldownTable({ activeKey, drilldowns }: Props) {
  if (!activeKey) return null;

  const rows = (drilldowns[activeKey] ?? []) as DrilldownRow[];
  const title = PANEL_TITLES[activeKey];

  return (
    <section data-testid="portfolio-drilldown-panel" className="mt-6">
      <h2 className="text-base font-semibold mb-2">{title}</h2>
      {rows.length === 0 ? (
        <div className="text-center py-8 text-slate-500">
          <p className="font-semibold">No items in this drill-down</p>
          <p className="text-sm mt-1">
            The selected KPI has zero matching rows for the current filters.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {activeKey === 'overdue_milestones' && (
                <>
                  <TableHead className="h-8 px-2 text-xs">Milestone</TableHead>
                  <TableHead className="h-8 px-2 text-xs">Project</TableHead>
                </>
              )}
              {activeKey === 'high_raid' && (
                <>
                  <TableHead className="h-8 px-2 text-xs">Code</TableHead>
                  <TableHead className="h-8 px-2 text-xs">Type</TableHead>
                </>
              )}
              {activeKey === 'technology_council' && (
                <TableHead className="h-8 px-2 text-xs">Issue</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {activeKey === 'overdue_milestones' && <OverdueRows rows={rows} />}
            {activeKey === 'high_raid' && <HighRaidRows rows={rows} />}
            {activeKey === 'technology_council' && <TechCouncilRows rows={rows} />}
          </TableBody>
        </Table>
        </div>
      )}
    </section>
  );
}
