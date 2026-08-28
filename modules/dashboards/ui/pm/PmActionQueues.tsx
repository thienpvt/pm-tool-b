'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type {
  PmDashboardMilestoneAction,
  PmDashboardPayload,
  PmDashboardRaidAction,
  PmDashboardWeeklyAction,
  PortfolioDashboardListRow,
} from '@/modules/dashboards/ui/shared/types';

type PmActionQueuesProps = {
  projects: PortfolioDashboardListRow[];
  actions: PmDashboardPayload['actions'];
};

function projectName(projects: PortfolioDashboardListRow[], projectId: number): string {
  return projects.find((p) => p.id === projectId)?.name ?? String(projectId);
}

function CountBadge({ count }: { count: number }) {
  if (count === 0) return null;
  return <span className="text-xs font-semibold text-muted-foreground ml-1">({count})</span>;
}

function WeeklyQueue({
  rows,
  projects,
}: {
  rows: PmDashboardWeeklyAction[];
  projects: PortfolioDashboardListRow[];
}) {
  return (
    <Card size="sm" className="mb-4" data-testid="pm-weekly-queue">
      <div className="px-3 pt-3 pb-1">
        <h2 className="text-base font-semibold">
          Weekly reports
          <CountBadge count={rows.length} />
        </h2>
      </div>
      <div className="overflow-x-auto px-3 pb-3">
        {rows.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-slate-600">No weekly reports due</p>
            <p className="text-sm text-muted-foreground mt-1">
              All obligated weekly reports for your assigned projects are submitted.
            </p>
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 px-2 text-xs">Project</TableHead>
              <TableHead className="h-8 px-2 text-xs">Period</TableHead>
              <TableHead className="h-8 px-2 text-xs">Due</TableHead>
              <TableHead className="h-8 px-2 text-xs">Status</TableHead>
              <TableHead className="h-8 px-2 text-xs">Overdue</TableHead>
              <TableHead className="h-8 px-2 text-xs">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.project_id}-${row.report_id}`}>
                <TableCell className="p-2 text-sm">{projectName(projects, row.project_id)}</TableCell>
                <TableCell className="p-2 text-sm">{row.period_display_name}</TableCell>
                <TableCell className="p-2 text-sm">{row.due_at ?? '—'}</TableCell>
                <TableCell className="p-2 text-sm">
                  <Badge variant="secondary">{row.status}</Badge>
                </TableCell>
                <TableCell className="p-2 text-sm">
                  {row.overdue ? (
                    <Badge className="bg-red-100 text-red-700">Overdue</Badge>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell className="p-2 text-sm">
                  <Link href={row.href} className="text-blue-600 text-sm hover:underline">
                    Open report
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function MilestonesQueue({
  rows,
  projects,
}: {
  rows: PmDashboardMilestoneAction[];
  projects: PortfolioDashboardListRow[];
}) {
  return (
    <Card size="sm" className="mb-4" data-testid="pm-milestones-queue">
      <div className="px-3 pt-3 pb-1">
        <h2 className="text-base font-semibold">
          Milestones
          <CountBadge count={rows.length} />
        </h2>
      </div>
      <div className="overflow-x-auto px-3 pb-3">
        {rows.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-slate-600">No milestone actions</p>
            <p className="text-sm text-muted-foreground mt-1">
              No upcoming or overdue milestones on your assigned projects.
            </p>
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 px-2 text-xs">Project</TableHead>
              <TableHead className="h-8 px-2 text-xs">Milestone</TableHead>
              <TableHead className="h-8 px-2 text-xs">Plan end</TableHead>
              <TableHead className="h-8 px-2 text-xs">Kind</TableHead>
              <TableHead className="h-8 px-2 text-xs">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.project_id}-${row.milestone_id}`}>
                <TableCell className="p-2 text-sm">{projectName(projects, row.project_id)}</TableCell>
                <TableCell className="p-2 text-sm">
                  <span className="truncate max-w-[200px] inline-block" title={row.name}>
                    {row.name}
                  </span>
                </TableCell>
                <TableCell className="p-2 text-sm">{row.plan_end ?? '—'}</TableCell>
                <TableCell className="p-2 text-sm">
                  <Badge variant="secondary">{row.kind}</Badge>
                </TableCell>
                <TableCell className="p-2 text-sm">
                  <Link href={row.href} className="text-blue-600 text-sm hover:underline">
                    View milestone
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

function RaidQueue({
  rows,
  projects,
}: {
  rows: PmDashboardRaidAction[];
  projects: PortfolioDashboardListRow[];
}) {
  return (
    <Card size="sm" className="mb-4" data-testid="pm-raid-queue">
      <div className="px-3 pt-3 pb-1">
        <h2 className="text-base font-semibold">
          RAID
          <CountBadge count={rows.length} />
        </h2>
      </div>
      <div className="overflow-x-auto px-3 pb-3">
        {rows.length === 0 ? (
          <div className="py-6 text-center">
            <p className="text-sm font-semibold text-slate-600">No RAID actions</p>
            <p className="text-sm text-muted-foreground mt-1">
              No high-priority RAID items due on your assigned projects.
            </p>
          </div>
        ) : null}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 px-2 text-xs">Project</TableHead>
              <TableHead className="h-8 px-2 text-xs">Code</TableHead>
              <TableHead className="h-8 px-2 text-xs">Type</TableHead>
              <TableHead className="h-8 px-2 text-xs">Due</TableHead>
              <TableHead className="h-8 px-2 text-xs">Tech council</TableHead>
              <TableHead className="h-8 px-2 text-xs">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${row.project_id}-${row.entity_type}-${row.id}`}>
                <TableCell className="p-2 text-sm">{projectName(projects, row.project_id)}</TableCell>
                <TableCell className="p-2 text-sm">
                  <span className="truncate max-w-[200px] inline-block" title={row.code}>
                    {row.code}
                  </span>
                </TableCell>
                <TableCell className="p-2 text-sm">{row.entity_type}</TableCell>
                <TableCell className="p-2 text-sm">{row.due_date ?? '—'}</TableCell>
                <TableCell className="p-2 text-sm">{row.has_technology_council ? 'Yes' : '—'}</TableCell>
                <TableCell className="p-2 text-sm">
                  <Link href={row.href} className="text-blue-600 text-sm hover:underline">
                    View RAID
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

export function PmActionQueues({ projects, actions }: PmActionQueuesProps) {
  return (
    <>
      <WeeklyQueue rows={actions.weekly} projects={projects} />
      <MilestonesQueue rows={actions.milestones} projects={projects} />
      <RaidQueue rows={actions.raid} projects={projects} />
    </>
  );
}
