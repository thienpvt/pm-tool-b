/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim extract from pre-layer route */
import {
  activityCompletionByProject,
  companyNameAndQuota,
  createPortfolioBudget,
  createPortfolioBudgetAllocation,
  createPortfolioBudgetCategory,
  createPortfolioMember,
  deletePortfolioBudget,
  deletePortfolioBudgetAllocation,
  deletePortfolioBudgetCategory,
  deletePortfolioMember,
  deletePortfolioProgramAllocation,
  findPortfolioBudget,
  issueCountsByProject,
  listPortfolioBudgets,
  listPortfolioMilestones as listPortfolioMilestonesRepo,
  listPortfolioProjects,
  portfolioBudgetAllocations,
  portfolioBudgetCategories,
  portfolioMembersWithUtilization,
  programFteAllocations,
  riskCountsByProject,
  setCompanyHeadcountQuota,
  spendByCategory,
  updatePortfolioBudget,
  updatePortfolioBudgetAllocation,
  updatePortfolioBudgetCategory,
  updatePortfolioMember,
  updatePortfolioProgramAllocation,
  upsertPortfolioProgramAllocation,
} from '@/lib/repositories/portfolio.repo';
import { listPrograms } from '@/lib/repositories/programs.repo';
import type { AccessActor } from './access';
import { NotFoundError, ValidationError } from './errors';

/**
 * Portfolio home aggregate (GET /api/portfolio).
 *
 * Company-scoped: filters by actor.company_id with is_admin bypass.
 * Does NOT call assertProjectAccess — this is not project-scoped.
 *
 * RAG thresholds below are the inline hand-roll from the pre-extraction route
 * (`open_risks >= 3` → red, `<= 14` days → amber). They DIVERGE from
 * `lib/rag.ts:calculateRAG`. Extracted verbatim (behavior freeze). Reconciliation
 * is a separate HYG-02 commit, not a silent fix inside this refactor.
 */
export async function getPortfolioSummary(actor: AccessActor) {
  const [projects, programs, riskCounts, issueCounts, activityStats] = await Promise.all([
    listPortfolioProjects(actor.company_id, Boolean(actor.is_admin)) as Promise<any[]>,
    listPrograms(actor.company_id, Boolean(actor.is_admin)) as Promise<any[]>,
    riskCountsByProject() as Promise<any[]>,
    issueCountsByProject() as Promise<any[]>,
    activityCompletionByProject() as Promise<any[]>,
  ]);

  const riskMap = Object.fromEntries(riskCounts.map((r: any) => [r.project_id, r]));
  const issueMap = Object.fromEntries(issueCounts.map((r: any) => [r.project_id, r]));
  const actMap = Object.fromEntries(activityStats.map((r: any) => [r.project_id, r]));

  const nowMs = Date.now();
  const enrichedProjects = projects.map((p: any) => {
    const open_risks: number = riskMap[p.id]?.open ?? 0;
    const open_issues: number = issueMap[p.id]?.open ?? 0;
    const completion_pct = Math.round(actMap[p.id]?.avg_pct ?? 0);
    const total_activities: number = actMap[p.id]?.total ?? 0;
    const done_activities: number = actMap[p.id]?.done ?? 0;

    const endMs = p.end_date ? new Date(p.end_date + 'T23:59:59').getTime() : null;
    const days_until_deadline = endMs ? Math.ceil((endMs - nowMs) / 86400000) : null;

    // INLINE RAG — diverges from lib/rag.ts:calculateRAG. Do not substitute. (HYG-02 deferred)
    let rag: 'red' | 'amber' | 'green' = 'green';
    if (p.current_phase !== 'Closing') {
      if ((days_until_deadline !== null && days_until_deadline < 0) || open_risks >= 3) {
        rag = 'red';
      } else if (
        (days_until_deadline !== null && days_until_deadline <= 14) ||
        open_risks >= 1 || open_issues >= 1 ||
        (completion_pct < 30 && total_activities > 0)
      ) {
        rag = 'amber';
      }
    }

    return {
      ...p,
      open_risks, total_risks: riskMap[p.id]?.total ?? 0,
      open_issues, total_issues: issueMap[p.id]?.total ?? 0,
      completion_pct, total_activities, done_activities,
      days_until_deadline, rag,
    };
  });

  const byProgram = programs.map((c: any) => ({
    ...c,
    projects: enrichedProjects.filter((p: any) => p.customer_id === c.id),
  }));
  const noProgram = enrichedProjects.filter((p: any) => !p.customer_id);

  const phases = ['Initiation', 'Planning', 'Execution', 'Closing'];
  const phaseDist = phases.map(phase => ({
    phase,
    count: projects.filter((p: any) => p.current_phase === phase).length,
  }));

  const programBar = byProgram.map((c: any) => ({
    name: c.name,
    count: c.projects.length,
    active: c.projects.filter((p: any) => p.current_phase !== 'Closing').length,
  })).sort((a: any, b: any) => b.count - a.count).slice(0, 10);

  const totalOpenRisks = enrichedProjects.reduce((s: number, p: any) => s + p.open_risks, 0);
  const totalOpenIssues = enrichedProjects.reduce((s: number, p: any) => s + p.open_issues, 0);
  const avgCompletion = enrichedProjects.length
    ? Math.round(enrichedProjects.reduce((s: number, p: any) => s + p.completion_pct, 0) / enrichedProjects.length)
    : 0;

  return {
    projects: enrichedProjects,
    programs: byProgram,
    noProgramProjects: noProgram,
    phaseDist,
    programBar,
    kpi: {
      totalProjects: projects.length,
      totalPrograms: programs.length,
      totalOpenRisks,
      totalOpenIssues,
      avgCompletion,
      activeProjects: projects.filter((p: any) => p.current_phase !== 'Closing').length,
    },
  };
}

/**
 * Portfolio sub-resources below (budgets, members, milestones, program
 * allocations, quota) — company-scoped like `getPortfolioSummary` above.
 *
 * Note: unlike `listPortfolioProjects`/`listPrograms`, the underlying budget/
 * member/quota/allocation repository functions take only `companyId` — they
 * never had an `is_admin` all-companies branch (Phase 2 baseline, gap-closure
 * scope is wiring not expanding admin reach). Services below thread
 * `actor.company_id` through unchanged; adding an admin-sees-all branch here
 * would be new behavior, not the consistency hardening this plan scopes.
 */

// ── Budgets ───────────────────────────────────────────────────────────────────

export async function listBudgets(actor: AccessActor) {
  return listPortfolioBudgets(actor.company_id);
}

/**
 * Reproduces the pre-extraction `budgets/[id]` GET aggregate byte-identically:
 * allocations + per-category `spendByCategory` warning loop.
 */
export async function getBudget(budgetId: number | string, actor: AccessActor) {
  const budget = await findPortfolioBudget(actor.company_id, budgetId);
  if (!budget) throw new NotFoundError('Not found', 'portfolio_budget');

  const [categories, allocations] = await Promise.all([
    portfolioBudgetCategories(budgetId),
    portfolioBudgetAllocations(budgetId),
  ]);

  const totalAllocated = (allocations as Array<{ allocated_amount: number }>)
    .reduce((s, a) => s + Number(a.allocated_amount), 0);

  const categoryWarnings: Record<string, { ceiling: number; used: number }> = {};
  for (const cat of categories as Array<{ category: string; ceiling_amount: number }>) {
    const row = await spendByCategory(budgetId, cat.category);
    categoryWarnings[cat.category] = {
      ceiling: Number(cat.ceiling_amount),
      used: Number(row?.used ?? 0),
    };
  }

  return {
    budget,
    categories,
    allocations,
    summary: {
      total_allocated: totalAllocated,
      over_total: totalAllocated > Number((budget as { total_amount: number }).total_amount),
      category_warnings: categoryWarnings,
    },
  };
}

export type PortfolioBudgetBody = {
  period_type?: string;
  period_label?: string;
  start_date?: string;
  end_date?: string;
  total_amount?: number | string;
  currency?: string;
  notes?: string;
};

export async function createBudget(actor: AccessActor, body: PortfolioBudgetBody) {
  if (!body.period_label || !body.start_date || !body.end_date) {
    throw new ValidationError('period_label, start_date, end_date required');
  }
  return createPortfolioBudget(actor.company_id, body);
}

export async function updateBudget(
  budgetId: number | string,
  actor: AccessActor,
  body: PortfolioBudgetBody & { status?: string },
) {
  const existing = await findPortfolioBudget(actor.company_id, budgetId);
  if (!existing) throw new NotFoundError('Not found', 'portfolio_budget');
  return updatePortfolioBudget(budgetId, body);
}

export async function deleteBudget(budgetId: number | string, actor: AccessActor) {
  const existing = await findPortfolioBudget(actor.company_id, budgetId);
  if (!existing) throw new NotFoundError('Not found', 'portfolio_budget');
  await deletePortfolioBudget(actor.company_id, budgetId);
  return { ok: true as const };
}

// ── Budget allocations ────────────────────────────────────────────────────────

export async function listBudgetAllocations(budgetId: number | string, actor: AccessActor) {
  const budget = await findPortfolioBudget(actor.company_id, budgetId);
  if (!budget) throw new NotFoundError('Not found', 'portfolio_budget');
  return portfolioBudgetAllocations(budgetId);
}

export type BudgetAllocationBody = {
  project_id?: number | string | null;
  allocated_amount?: number | string;
  notes?: string;
};

export async function createBudgetAllocation(
  budgetId: number | string,
  actor: AccessActor,
  body: BudgetAllocationBody,
) {
  const budget = await findPortfolioBudget(actor.company_id, budgetId);
  if (!budget) throw new NotFoundError('Not found', 'portfolio_budget');
  return createPortfolioBudgetAllocation(budgetId, body);
}

export async function updateBudgetAllocation(
  budgetId: number | string,
  allocationId: number | string,
  actor: AccessActor,
  body: BudgetAllocationBody,
) {
  const budget = await findPortfolioBudget(actor.company_id, budgetId);
  if (!budget) throw new NotFoundError('Not found', 'portfolio_budget');
  const updated = await updatePortfolioBudgetAllocation(budgetId, allocationId, body);
  if (!updated) throw new NotFoundError('Not found', 'portfolio_budget_allocation');
  return updated;
}

export async function deleteBudgetAllocation(
  budgetId: number | string,
  allocationId: number | string,
  actor: AccessActor,
) {
  const budget = await findPortfolioBudget(actor.company_id, budgetId);
  if (!budget) throw new NotFoundError('Not found', 'portfolio_budget');
  await deletePortfolioBudgetAllocation(budgetId, allocationId);
  return { ok: true as const };
}

// ── Budget categories ─────────────────────────────────────────────────────────

export async function listBudgetCategories(budgetId: number | string, actor: AccessActor) {
  const budget = await findPortfolioBudget(actor.company_id, budgetId);
  if (!budget) throw new NotFoundError('Not found', 'portfolio_budget');
  return portfolioBudgetCategories(budgetId);
}

export type BudgetCategoryBody = { category?: string; ceiling_amount?: number | string; notes?: string };

export async function createBudgetCategory(
  budgetId: number | string,
  actor: AccessActor,
  body: BudgetCategoryBody,
) {
  const budget = await findPortfolioBudget(actor.company_id, budgetId);
  if (!budget) throw new NotFoundError('Not found', 'portfolio_budget');
  if (!body.category) throw new ValidationError('category required', 'category');
  return createPortfolioBudgetCategory(budgetId, body);
}

export async function updateBudgetCategory(
  budgetId: number | string,
  categoryId: number | string,
  actor: AccessActor,
  body: BudgetCategoryBody,
) {
  const budget = await findPortfolioBudget(actor.company_id, budgetId);
  if (!budget) throw new NotFoundError('Not found', 'portfolio_budget');
  const updated = await updatePortfolioBudgetCategory(budgetId, categoryId, body);
  if (!updated) throw new NotFoundError('Not found', 'portfolio_budget_category');
  return updated;
}

export async function deleteBudgetCategory(
  budgetId: number | string,
  categoryId: number | string,
  actor: AccessActor,
) {
  const budget = await findPortfolioBudget(actor.company_id, budgetId);
  if (!budget) throw new NotFoundError('Not found', 'portfolio_budget');
  await deletePortfolioBudgetCategory(budgetId, categoryId);
  return { ok: true as const };
}

// ── Members ───────────────────────────────────────────────────────────────────

export async function listMembers(actor: AccessActor) {
  return portfolioMembersWithUtilization(actor.company_id);
}

export type PortfolioMemberBody = {
  role?: string;
  name?: string;
  email?: string;
  note?: string;
  member_type?: string;
  member_category?: string;
  overhead_remaining?: number | string;
};

function normalizeMemberBody(body: PortfolioMemberBody) {
  if (!body.name?.trim()) throw new ValidationError('Name is required', 'name');
  return {
    role: body.role ?? '',
    name: body.name.trim(),
    email: body.email ?? '',
    note: body.note ?? '',
    member_type: body.member_type ?? 'internal',
    member_category: body.member_category ?? 'delivery',
    overhead_remaining: body.overhead_remaining ?? 0,
  };
}

export async function createMember(actor: AccessActor, body: PortfolioMemberBody) {
  return createPortfolioMember(actor.company_id, normalizeMemberBody(body));
}

export async function updateMember(
  memberId: number | string,
  actor: AccessActor,
  body: PortfolioMemberBody,
) {
  const row = await updatePortfolioMember(actor.company_id, memberId, normalizeMemberBody(body));
  if (!row) throw new NotFoundError('Not found', 'portfolio_member');
  return row;
}

export async function deleteMember(memberId: number | string, actor: AccessActor) {
  await deletePortfolioMember(actor.company_id, memberId);
  return { ok: true as const };
}

// ── Milestones ────────────────────────────────────────────────────────────────

export async function listPortfolioMilestones(actor: AccessActor) {
  return listPortfolioMilestonesRepo(actor.company_id, Boolean(actor.is_admin));
}

// ── Program allocations ───────────────────────────────────────────────────────

export async function listProgramAllocations(actor: AccessActor) {
  if (!actor.company_id) return [];
  return programFteAllocations(actor.company_id);
}

/**
 * HYG-02: this is where the pre-extraction route's `catch { String(e) }` leak
 * lived. The service throws (or lets the repository throw) untouched — the
 * route's `serviceErrorResponse` maps any unhandled error to a generic 500,
 * never the raw error text.
 */
export async function createProgramAllocation(
  actor: AccessActor,
  body: { program_id?: unknown; allocated_headcount?: unknown },
) {
  const { program_id, allocated_headcount } = body;
  if (!program_id) throw new ValidationError('program_id required', 'program_id');
  const headcount = Math.max(0, Number(allocated_headcount) || 0);
  const pid = Number(program_id);
  await upsertPortfolioProgramAllocation(actor.company_id, pid, headcount);
  return { program_id: pid, allocated_headcount: headcount };
}

export async function updateProgramAllocation(
  allocationId: number | string,
  actor: AccessActor,
  allocatedHeadcount: unknown,
) {
  const headcount = Math.max(0, Number(allocatedHeadcount) || 0);
  await updatePortfolioProgramAllocation(actor.company_id, allocationId, headcount);
  return { id: Number(allocationId), allocated_headcount: headcount };
}

export async function deleteProgramAllocation(allocationId: number | string, actor: AccessActor) {
  await deletePortfolioProgramAllocation(actor.company_id, allocationId);
  return { ok: true as const };
}

// ── Quota ─────────────────────────────────────────────────────────────────────

export async function getQuota(actor: AccessActor) {
  const company = await companyNameAndQuota(actor.company_id);
  return { headcount_quota: company?.headcount_quota ?? 0 };
}

export async function updateQuota(actor: AccessActor, body: { headcount_quota?: unknown }) {
  const quota = Math.max(0, Number(body.headcount_quota) || 0);
  await setCompanyHeadcountQuota(actor.company_id, quota);
  return { headcount_quota: quota };
}
