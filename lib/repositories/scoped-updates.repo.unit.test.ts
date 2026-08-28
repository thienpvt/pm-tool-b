import { beforeEach, describe, expect, it, vi } from 'vitest';

const { db } = vi.hoisted(() => ({
  db: {
    get: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
    exec: vi.fn(),
  },
}));

vi.mock('@/lib/db', () => ({ getDb: vi.fn(async () => db) }));

import { updateActivity } from './activities.repo';
import { updateBudgetItem } from './budget.repo';
import { updateEscalation } from './escalations.repo';
import { updateIssue } from './issues.repo';
import { updateMeeting } from './meetings.repo';
import { updateMilestone } from './milestones.repo';
import { updateOperationsBudgetItem, updateOperationsIncident } from '@/modules/operations/backend/repositories/operations.repo';
import {
  updatePortfolioBudgetAllocation,
  updatePortfolioBudgetCategory,
  updatePortfolioMember,
} from './portfolio.repo';
import { updateRisk } from './risks.repo';
import { updateTeamMember } from './team.repo';

beforeEach(() => {
  vi.clearAllMocks();
  db.get.mockResolvedValue(undefined);
});

const cases = [
  {
    name: 'budget item',
    invoke: () => updateBudgetItem(1, 2, { type: 'CAPEX', name: 'Server' }),
    table: 'budget_items',
    scope: /WHERE id\s*=\s*\? AND project_id\s*=\s*\?/,
  },
  {
    name: 'activity',
    invoke: () => updateActivity(1, 2, { activity: 'Scoped' }),
    table: 'activities',
    scope: /WHERE id\s*=\s*\? AND project_id\s*=\s*\?/,
  },
  {
    name: 'milestone',
    invoke: () => updateMilestone(1, 2, { name: 'Scoped' }),
    table: 'milestones',
    scope: /WHERE id\s*=\s*\? AND project_id\s*=\s*\?/,
  },
  {
    name: 'operations budget item',
    invoke: () => updateOperationsBudgetItem(1, 2, {}),
    table: 'operations_budget_items',
    scope: /WHERE id\s*=\s*\? AND operations_system_id\s*=\s*\?/,
  },
  {
    name: 'operations incident',
    invoke: () => updateOperationsIncident(1, 2, {}),
    table: 'operations_incidents',
    scope: /WHERE id\s*=\s*\? AND operations_system_id\s*=\s*\?/,
  },
  {
    name: 'portfolio member',
    invoke: () => updatePortfolioMember(1, 2, { name: 'Scoped' }),
    table: 'portfolio_members',
    scope: /WHERE id\s*=\s*\? AND company_id\s*=\s*\?/,
  },
  {
    name: 'portfolio budget allocation',
    invoke: () => updatePortfolioBudgetAllocation(1, 2, {}),
    table: 'portfolio_budget_allocations',
    scope: /WHERE id\s*=\s*\? AND portfolio_budget_id\s*=\s*\?/,
  },
  {
    name: 'portfolio budget category',
    invoke: () => updatePortfolioBudgetCategory(1, 2, {}),
    table: 'portfolio_budget_categories',
    scope: /WHERE id\s*=\s*\? AND portfolio_budget_id\s*=\s*\?/,
  },
  {
    name: 'risk',
    invoke: () => updateRisk(1, 2, { description: 'Scoped' }),
    table: 'risks',
    scope: /WHERE id\s*=\s*\? AND project_id\s*=\s*\?/,
  },
  {
    name: 'issue',
    invoke: () => updateIssue(1, 2, { description: 'Scoped' }),
    table: 'issues',
    scope: /WHERE id\s*=\s*\? AND project_id\s*=\s*\?/,
  },
  {
    name: 'meeting',
    invoke: () => updateMeeting(1, 2, { name: 'Scoped' }),
    table: 'meetings',
    scope: /WHERE id\s*=\s*\? AND project_id\s*=\s*\?/,
  },
  {
    name: 'team member',
    invoke: () => updateTeamMember(1, 2, { name: 'Scoped' }),
    table: 'team_members',
    scope: /WHERE id\s*=\s*\? AND project_id\s*=\s*\?/,
  },
  {
    name: 'escalation',
    invoke: () => updateEscalation(1, 2, { level_name: 'Scoped' }),
    table: 'escalation_levels',
    scope: /WHERE id\s*=\s*\? AND project_id\s*=\s*\?/,
  },
] as const;

describe('scoped update return values', () => {
  it.each(cases)('returns no row for a foreign $name id', async ({ invoke, table, scope }) => {
    await expect(invoke()).resolves.toBeUndefined();

    const sql = String(db.get.mock.calls[0][0]).replace(/\s+/g, ' ').trim();
    expect(sql).toMatch(new RegExp(`UPDATE ${table}`));
    expect(sql).toMatch(scope);
    expect(sql).toContain('RETURNING *');
    expect(db.get).toHaveBeenCalledTimes(1);
    expect(db.run).not.toHaveBeenCalled();
  });
});
