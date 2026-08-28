import {
  createPeriodWithShells,
  getCompanyWeeklyConfig as getCompanyWeeklyConfigRepo,
  listWeeklyPeriods as listWeeklyPeriodsRepo,
  upsertCompanyWeeklyConfig as upsertCompanyWeeklyConfigRepo,
} from '@/modules/weekly/backend/repositories/weekly-periods.repo';
import {
  finalizeWeeklyReportSubmit,
  getLatestVersionSnapshot,
  getPriorPeriodSubmittedRag,
  getWeeklyPeriodByCompany,
  getWeeklyReportFullRow,
  getWeeklyReportWithPeriod,
  insertWeeklyReportVersion,
  lockWeeklyReportShell,
  listPeriodShellsRepo,
  listProjectWeeklyHistoryRepo,
  openCorrectionOnShell,
  updatePrevWeekRag,
  updateWeeklyReportDraft,
  type DraftUpdateFields,
} from '@/lib/repositories/weekly-reports.repo';
import { getProject, updateProject } from '@/lib/repositories/projects.repo';
import { getMilestone } from '@/lib/repositories/milestones.repo';
import { getRisk } from '@/lib/repositories/risks.repo';
import { getIssue } from '@/lib/repositories/issues.repo';
import { createRisk, updateRisk } from '@/lib/services/risks.service';
import { createIssue, updateIssue } from '@/lib/services/issues.service';
import { ISO_WEEK_PATTERN } from '@/lib/iso-week';
import {
  assertCompanyWrite,
  assertProjectAccess,
  assertProjectWriteAccess,
  type AccessActor,
} from '@/lib/services/access';
import { auditLog } from '@/modules/audit/backend/services/audit.service';
import { runInTransaction } from '@/lib/db';
import { ConflictError, ForbiddenError, NotFoundError, SubmitValidationError, ValidationError } from '@/lib/services/errors';

const DEFAULT_CONFIG = { due_weekday: 5, due_time_utc: '18:00:00' };

const DRAFT_ALLOWLIST = new Set([
  'highlights',
  'completed_work',
  'next_week_goals',
  'nearest_milestone',
  'nearest_milestone_id',
  'raid_dependency',
  'leadership_support',
  'this_week_rag',
  'draft_raid_json',
]);

const VALID_RAG = new Set(['Green', 'Amber', 'Red', 'Not applicable']);

function isPgUniqueViolation(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { code: string }).code === '23505';
}

function validateRag(value: unknown): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string' || !VALID_RAG.has(value)) {
    throw new ValidationError('Invalid this_week_rag', 'this_week_rag');
  }
}

function pickAllowlistedDraft(fields: Record<string, unknown>): DraftUpdateFields {
  const out: DraftUpdateFields = {};
  for (const key of DRAFT_ALLOWLIST) {
    if (key in fields) {
      (out as Record<string, unknown>)[key] = fields[key];
    }
  }
  return out;
}

function buildSnapshotFromShell(shell: {
  highlights: string | null;
  completed_work: string | null;
  next_week_goals: string | null;
  nearest_milestone: string | null;
  nearest_milestone_id: number | null;
  raid_dependency: string | null;
  leadership_support: string | null;
  this_week_rag: string | null;
  prev_week_rag: string | null;
}): Record<string, unknown> {
  return {
    highlights: shell.highlights,
    completed_work: shell.completed_work,
    next_week_goals: shell.next_week_goals,
    nearest_milestone: {
      text: shell.nearest_milestone,
      milestone_id: shell.nearest_milestone_id,
    },
    raid_dependency: shell.raid_dependency,
    leadership_support: shell.leadership_support,
    this_week_rag: shell.this_week_rag,
    prev_week_rag: shell.prev_week_rag,
  };
}

type DraftRaidEntry = { id: number | 'new'; fields: Record<string, unknown> };

function parseDraftRaidJson(raw: unknown): { risks: DraftRaidEntry[]; issues: DraftRaidEntry[] } {
  if (!raw || typeof raw !== 'object') return { risks: [], issues: [] };
  const obj = raw as Record<string, unknown>;
  const risks = Array.isArray(obj.risks) ? (obj.risks as DraftRaidEntry[]) : [];
  const issues = Array.isArray(obj.issues) ? (obj.issues as DraftRaidEntry[]) : [];
  return { risks, issues };
}

function isDeactivatedRaidRow(row: Record<string, unknown>): boolean {
  return row.status === 'deactivated' || row.deactivated_at != null;
}

async function validateSubmitDraft(
  projectId: number,
  shell: {
    nearest_milestone_id: number | null;
    draft_raid_json: unknown | null;
  },
): Promise<{ fields: string[]; milestoneRow: Record<string, unknown> | null }> {
  const fields: string[] = [];
  let milestoneRow: Record<string, unknown> | null = null;
  const draftRaid = parseDraftRaidJson(shell.draft_raid_json);

  for (let i = 0; i < draftRaid.risks.length; i++) {
    const entry = draftRaid.risks[i];
    if (!entry || typeof entry !== 'object') {
      fields.push(`raid.risks[${i}]`);
      continue;
    }
    const entryFields = entry.fields && typeof entry.fields === 'object' ? entry.fields : {};
    if (entry.id === 'new') {
      const desc = typeof entryFields.description === 'string' ? entryFields.description.trim() : '';
      if (!desc) fields.push(`raid.risks[${i}].description`);
    } else if (typeof entry.id === 'number') {
      const risk = await getRisk(projectId, entry.id);
      if (!risk || isDeactivatedRaidRow(risk as Record<string, unknown>)) {
        fields.push(`raid.risks[${i}].id`);
      }
    } else {
      fields.push(`raid.risks[${i}].id`);
    }
  }

  for (let i = 0; i < draftRaid.issues.length; i++) {
    const entry = draftRaid.issues[i];
    if (!entry || typeof entry !== 'object') {
      fields.push(`raid.issues[${i}]`);
      continue;
    }
    const entryFields = entry.fields && typeof entry.fields === 'object' ? entry.fields : {};
    if (entry.id === 'new') {
      const desc = typeof entryFields.description === 'string' ? entryFields.description.trim() : '';
      if (!desc) fields.push(`raid.issues[${i}].description`);
    } else if (typeof entry.id === 'number') {
      const issue = await getIssue(projectId, entry.id);
      if (!issue || isDeactivatedRaidRow(issue as Record<string, unknown>)) {
        fields.push(`raid.issues[${i}].id`);
      }
    } else {
      fields.push(`raid.issues[${i}].id`);
    }
  }

  if (shell.nearest_milestone_id != null) {
    milestoneRow = (await getMilestone(projectId, shell.nearest_milestone_id)) as Record<
      string,
      unknown
    > | null;
    if (!milestoneRow) fields.push('nearest_milestone_id');
  }

  return { fields, milestoneRow };
}

function copyMilestoneSnapshot(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    plan_end: row.plan_end ?? null,
    adjusted_end: row.adjusted_end ?? null,
    status: row.status ?? null,
    end_date: row.end_date ?? null,
  };
}

function raidSnapshotToDraftJson(snapshot: Record<string, unknown>): unknown | null {
  if (snapshot.draft_raid_json != null) return snapshot.draft_raid_json;
  const raid = snapshot.raid;
  if (!raid || typeof raid !== 'object') return null;
  const { risks, issues } = raid as { risks?: unknown[]; issues?: unknown[] };
  const toEntry = (row: unknown) => {
    if (!row || typeof row !== 'object') return null;
    const r = row as Record<string, unknown>;
    const id = typeof r.id === 'number' ? r.id : null;
    if (id == null) return null;
    const { id: _id, ...fields } = r;
    return { id, fields };
  };
  return {
    risks: (Array.isArray(risks) ? risks : []).map(toEntry).filter(Boolean),
    issues: (Array.isArray(issues) ? issues : []).map(toEntry).filter(Boolean),
  };
}

function snapshotToDraftFields(snapshot: Record<string, unknown>): DraftUpdateFields {
  const nearest = snapshot.nearest_milestone;
  let nearestText: string | null = null;
  let nearestId: number | null = null;
  if (nearest && typeof nearest === 'object') {
    const n = nearest as Record<string, unknown>;
    nearestText = typeof n.text === 'string' ? n.text : null;
    nearestId = typeof n.milestone_id === 'number' ? n.milestone_id : null;
  }
  return {
    highlights: typeof snapshot.highlights === 'string' ? snapshot.highlights : null,
    completed_work: typeof snapshot.completed_work === 'string' ? snapshot.completed_work : null,
    next_week_goals: typeof snapshot.next_week_goals === 'string' ? snapshot.next_week_goals : null,
    nearest_milestone: nearestText,
    nearest_milestone_id: nearestId,
    raid_dependency: typeof snapshot.raid_dependency === 'string' ? snapshot.raid_dependency : null,
    leadership_support:
      typeof snapshot.leadership_support === 'string' ? snapshot.leadership_support : null,
    this_week_rag: typeof snapshot.this_week_rag === 'string' ? snapshot.this_week_rag : null,
    draft_raid_json: raidSnapshotToDraftJson(snapshot),
  };
}

function assertCanSubmit(shell: { status: string; correction_open: boolean }): void {
  const canSubmit =
    shell.status === 'draft'
    || shell.status === 'not_submitted'
    || shell.correction_open;
  if (!canSubmit) {
    throw new ConflictError('Report cannot be submitted in current state');
  }
}

export function isWeeklyReportOverdue(
  status: string,
  dueAt: Date | string,
  now: Date,
): boolean {
  if (status !== 'not_submitted' && status !== 'draft') return false;
  const due = dueAt instanceof Date ? dueAt : new Date(dueAt);
  return now.getTime() > due.getTime();
}

export async function getCompanyWeeklyConfig(actor: AccessActor) {
  if (actor.company_id === null) throw new ForbiddenError();
  const row = await getCompanyWeeklyConfigRepo(actor.company_id);
  return row ?? DEFAULT_CONFIG;
}

export async function upsertCompanyWeeklyConfig(
  actor: AccessActor,
  body: { due_weekday: number; due_time_utc: string },
) {
  assertCompanyWrite(actor);
  await upsertCompanyWeeklyConfigRepo(actor.company_id!, {
    due_weekday: body.due_weekday,
    due_time_utc: body.due_time_utc,
    updated_by: actor.user_id,
  });
}

export async function listWeeklyPeriods(actor: AccessActor) {
  if (actor.company_id === null) throw new ForbiddenError();
  return listWeeklyPeriodsRepo(actor.company_id);
}

export async function createWeeklyPeriod(
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  assertCompanyWrite(actor);
  const isoWeek = body.iso_week;
  if (typeof isoWeek !== 'string' || !ISO_WEEK_PATTERN.test(isoWeek)) {
    throw new ValidationError('Invalid iso_week format', 'iso_week');
  }

  try {
    const period = await createPeriodWithShells(actor.company_id!, isoWeek, actor.user_id);
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'weekly_period',
      entity_id: String(period.id),
      action: 'create',
      before: null,
      after: { iso_week: period.iso_week, display_name: period.display_name },
    });
    return period;
  } catch (err) {
    if (isPgUniqueViolation(err)) {
      throw new ConflictError('Period already exists for this iso_week');
    }
    throw err;
  }
}

async function ensurePrevWeekRag(
  projectId: number,
  reportId: number,
  shell: Awaited<ReturnType<typeof getWeeklyReportWithPeriod>>,
): Promise<string | null> {
  if (!shell) return null;
  if (shell.prev_week_rag !== null) return shell.prev_week_rag;

  let rag = await getPriorPeriodSubmittedRag(shell.company_id, projectId, shell.iso_week);
  if (!rag) {
    const project = await getProject(projectId);
    rag = project && typeof project.rag === 'string' ? project.rag : null;
  }
  await updatePrevWeekRag(projectId, reportId, rag);
  return rag;
}

export async function getWeeklyReportShell(
  projectId: number | string,
  actor: AccessActor,
  reportId: number | string,
) {
  await assertProjectAccess(projectId, actor);
  const shell = await getWeeklyReportWithPeriod(Number(projectId), Number(reportId));
  if (!shell) throw new NotFoundError('Not found', 'weekly_report');

  const prevWeekRag = await ensurePrevWeekRag(Number(projectId), Number(reportId), shell);
  return { ...shell, prev_week_rag: prevWeekRag };
}

export async function saveWeeklyReportDraft(
  projectId: number | string,
  reportId: number | string,
  actor: AccessActor,
  fields: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);

  const pid = Number(projectId);
  const rid = Number(reportId);
  const existing = await getWeeklyReportFullRow(pid, rid);
  if (!existing) throw new NotFoundError('Not found', 'weekly_report');

  if (existing.status === 'submitted' && !existing.correction_open) {
    throw new ConflictError('Submitted report cannot be edited');
  }

  const allowlisted = pickAllowlistedDraft(fields);
  validateRag(allowlisted.this_week_rag);

  const hasDraftField = Object.keys(allowlisted).length > 0;
  if (existing.status === 'not_submitted' && hasDraftField) {
    allowlisted.status = 'draft';
  }

  const updated = await updateWeeklyReportDraft(pid, rid, allowlisted);
  if (!updated) {
    if (existing.status === 'submitted' && !existing.correction_open) {
      throw new ConflictError('Submitted report cannot be edited');
    }
    throw new NotFoundError('Not found', 'weekly_report');
  }

  return getWeeklyReportShell(projectId, actor, reportId);
}

export async function submitWeeklyReport(
  projectId: number | string,
  reportId: number | string,
  actor: AccessActor,
) {
  await assertProjectWriteAccess(projectId, actor);

  const pid = Number(projectId);
  const rid = Number(reportId);
  const shell = await getWeeklyReportWithPeriod(pid, rid);
  if (!shell) throw new NotFoundError('Not found', 'weekly_report');

  assertCanSubmit(shell);

  if (!shell.this_week_rag) {
    throw new ValidationError('this_week_rag is required for submit', 'this_week_rag');
  }
  validateRag(shell.this_week_rag);

  const validation = await validateSubmitDraft(pid, shell);
  if (validation.fields.length > 0) {
    throw new SubmitValidationError('Submit validation failed', validation.fields);
  }

  let newVersion = shell.latest_version + 1;
  let isFirstSubmit = shell.first_submitted_at === null;

  try {
    await runInTransaction(async () => {
      const locked = await lockWeeklyReportShell(pid, rid);
      if (!locked) throw new NotFoundError('Not found', 'weekly_report');
      assertCanSubmit(locked);
      newVersion = locked.latest_version + 1;
      isFirstSubmit = locked.first_submitted_at === null;

      const draftRaid = parseDraftRaidJson(shell.draft_raid_json);
      const riskIds: number[] = [];
      for (const entry of draftRaid.risks) {
        if (!entry || typeof entry !== 'object') continue;
        const fields = entry.fields && typeof entry.fields === 'object' ? entry.fields : {};
        if (entry.id === 'new') {
          const created = await createRisk(pid, actor, fields);
          riskIds.push(Number(created.id));
        } else if (typeof entry.id === 'number') {
          await updateRisk(pid, actor, entry.id, fields);
          riskIds.push(entry.id);
        }
      }

      const issueIds: number[] = [];
      for (const entry of draftRaid.issues) {
        if (!entry || typeof entry !== 'object') continue;
        const fields = entry.fields && typeof entry.fields === 'object' ? entry.fields : {};
        if (entry.id === 'new') {
          const created = await createIssue(pid, actor, fields);
          issueIds.push(Number(created.id));
        } else if (typeof entry.id === 'number') {
          await updateIssue(pid, actor, entry.id, fields);
          issueIds.push(entry.id);
        }
      }

      const project = await getProject(pid);
      const progressPct = project && typeof project.progress_pct === 'number'
        ? project.progress_pct
        : Number(project?.progress_pct ?? 0) || 0;

      if (project && shell.this_week_rag !== project.rag) {
        await updateProject(pid, { rag: shell.this_week_rag });
      }

      const lockedRisks = [];
      for (const id of riskIds) {
        const row = await getRisk(pid, id);
        if (row) lockedRisks.push({ ...row });
      }
      const lockedIssues = [];
      for (const id of issueIds) {
        const row = await getIssue(pid, id);
        if (row) lockedIssues.push({ ...row });
      }

      const prevWeekRag = await ensurePrevWeekRag(pid, rid, shell);
      const shellForSnapshot = { ...shell, prev_week_rag: prevWeekRag };
      const snapshot = {
        ...buildSnapshotFromShell(shellForSnapshot),
        progress_pct: progressPct,
        raid: { risks: lockedRisks, issues: lockedIssues },
        milestones: validation.milestoneRow ? [copyMilestoneSnapshot(validation.milestoneRow)] : [],
      };
      const now = new Date().toISOString();

      await insertWeeklyReportVersion({
        reportId: rid,
        version: newVersion,
        snapshot,
        submittedAt: now,
        submittedBy: actor.user_id,
        rag: shell.this_week_rag,
        progressPct,
      });

      const dueAt = new Date(shell.due_at);
      const latenessForFirst = new Date(now).getTime() <= dueAt.getTime() ? 'on_time' : 'late';

      await finalizeWeeklyReportSubmit({
        projectId: pid,
        reportId: rid,
        latestVersion: newVersion,
        firstSubmittedAt: locked.first_submitted_at,
        firstLateness: isFirstSubmit ? latenessForFirst : locked.first_lateness,
        now,
      });
    });
  } catch (err) {
    if (isPgUniqueViolation(err)) throw new ConflictError('Report already submitted');
    throw err;
  }

  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'weekly_report',
    entity_id: String(rid),
    action: isFirstSubmit ? 'weekly_submit' : 'weekly_correct',
    before: null,
    after: { version: newVersion },
  });

  return getWeeklyReportShell(projectId, actor, reportId);
}

export async function openWeeklyReportCorrection(
  projectId: number | string,
  reportId: number | string,
  actor: AccessActor,
  body: Record<string, unknown> = {},
) {
  await assertProjectWriteAccess(projectId, actor);

  const pid = Number(projectId);
  const rid = Number(reportId);
  const shell = await getWeeklyReportFullRow(pid, rid);
  if (!shell) throw new NotFoundError('Not found', 'weekly_report');
  if (shell.status !== 'submitted') {
    throw new ConflictError('Correction is only available for submitted reports');
  }

  const snapshot = await getLatestVersionSnapshot(rid, shell.latest_version);
  if (!snapshot) throw new NotFoundError('Not found', 'weekly_report_version');

  const draftFromSnapshot = snapshotToDraftFields(snapshot);
  const overlay = pickAllowlistedDraft(body);
  validateRag(overlay.this_week_rag);
  const merged = { ...draftFromSnapshot, ...overlay };

  const updated = await openCorrectionOnShell(pid, rid, merged);
  if (!updated) throw new NotFoundError('Not found', 'weekly_report');

  return getWeeklyReportShell(projectId, actor, reportId);
}

export async function listProjectWeeklyHistory(
  projectId: number | string,
  actor: AccessActor,
) {
  await assertProjectAccess(projectId, actor);
  const rows = await listProjectWeeklyHistoryRepo(Number(projectId));
  const now = new Date();
  return rows.map((row) => ({
    display_name: row.display_name,
    iso_week: row.iso_week,
    status: row.status,
    overdue: isWeeklyReportOverdue(row.status, row.due_at, now),
    rag: row.rag,
    submitted_at: row.submitted_at,
    submitted_by: row.submitted_by,
    first_lateness: row.first_lateness,
    latest_version: row.latest_version,
    report_id: row.report_id,
    period_id: row.period_id,
  }));
}

export async function listPeriodShells(
  companyId: number,
  periodId: number,
  actor: AccessActor,
) {
  assertCompanyWrite(actor);
  if (actor.company_id !== companyId) throw new ForbiddenError();
  const period = await getWeeklyPeriodByCompany(companyId, periodId);
  if (!period) throw new NotFoundError('Not found', 'weekly_period');
  const rows = await listPeriodShellsRepo(companyId, periodId);
  const now = new Date();
  return rows.map((row) => ({
    project_id: row.project_id,
    status: row.status,
    overdue: isWeeklyReportOverdue(row.status, row.due_at, now),
    rag: row.rag,
    first_lateness: row.first_lateness,
    first_submitted_at: row.first_submitted_at,
    latest_version: row.latest_version,
    report_id: row.report_id,
  }));
}
