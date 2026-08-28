import {
  createProject as createProjectRepo,
  deleteProject as deleteProjectRepo,
  findProjectByCompanyCode,
  getProject as getProjectRepo,
  listProjects as listProjectsRepo,
  updateProject as updateProjectRepo,
} from '@/lib/repositories/projects.repo';
import { listChecklistByProject } from '@/modules/documents/backend/repositories/project-document-checklist.repo';
import { getProgram } from '@/lib/repositories/programs.repo';
import {
  assertProjectAccess,
  assertProjectWriteAccess,
  hasRole,
  isCpmo,
  type AccessActor,
} from './access';
import { auditLog } from '@/modules/audit/backend/services/audit.service';
import { generateProjectChecklist } from '@/modules/documents/backend/services/document-checklist-generate';
import {
  ConflictError,
  ForbiddenError,
  MandatoryIncompleteError,
  NotFoundError,
  ValidationError,
} from './errors';
import { applyProjectGovernance } from './project-governance';

function auditSnapshot(row: Record<string, unknown> | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    project_code: row.project_code,
    status: row.status,
    rag: row.rag,
    stage: row.stage,
    company_id: row.company_id,
    customer_id: row.customer_id,
    portfolio_year: row.portfolio_year,
  };
}

function snapshotsEqual(
  before: ReturnType<typeof auditSnapshot>,
  after: ReturnType<typeof auditSnapshot>,
): boolean {
  return JSON.stringify(before) === JSON.stringify(after);
}

/**
 * Owner-scoped project CRUD for `app/api/projects/[id]/route.ts` — the canonical
 * home for the ownership check that route used to keep as a file-local `checkAccess`.
 *
 * `updateProject` deliberately does NOT catch `UnknownColumnError` — it must propagate
 * to the route's catch chain so `repoErrorResponse` can map it to the REPO-03
 * 400-with-columns contract (T-04-25). Wrapping or swallowing it here would turn a
 * rejected `company_id` into a 500.
 */

/** Company-scoped list for `app/api/projects/route.ts` GET (SVC-01). */
export async function listProjects(actor: AccessActor) {
  const pmOnly =
    hasRole(actor, 'pm') && !hasRole(actor, 'cpmo') && !hasRole(actor, 'viewer');
  if (pmOnly) {
    return listProjectsRepo(actor.company_id, { pmUserId: actor.user_id });
  }
  return listProjectsRepo(actor.company_id);
}

/**
 * Create a project for `app/api/projects/route.ts` POST (SVC-01/SVC-04).
 *
 * CPMO-only: stamps the session company and ignores body.company_id (D-13).
 *
 * `createProject` deliberately does NOT catch `UnknownColumnError` — same
 * propagation contract as `updateProject` above.
 */
export async function createProject(actor: AccessActor, body: Record<string, unknown>) {
  if (!isCpmo(actor)) throw new ForbiddenError();
  if (actor.company_id === null) throw new ForbiddenError();

  const projectCode = typeof body.project_code === 'string' ? body.project_code.trim() : '';
  if (!projectCode) throw new ValidationError('project_code is required', 'project_code');

  const portfolioYear = body.portfolio_year;
  if (
    portfolioYear === undefined ||
    portfolioYear === null ||
    portfolioYear === '' ||
    !Number.isInteger(Number(portfolioYear))
  ) {
    throw new ValidationError('portfolio_year is required', 'portfolio_year');
  }

  const customerId = body.customer_id;
  if (customerId === undefined || customerId === null || customerId === '') {
    throw new ValidationError('customer_id is required', 'customer_id');
  }

  const program = await getProgram(Number(customerId));
  if (!program) throw new NotFoundError('Program not found', 'program');
  if (program.company_id !== actor.company_id) throw new ForbiddenError();

  if (await findProjectByCompanyCode(actor.company_id, projectCode)) {
    throw new ConflictError('Project code already exists');
  }

  const { fields, warnings } = applyProjectGovernance({
    ...body,
    project_code: projectCode,
    portfolio_year: Number(portfolioYear),
    customer_id: Number(customerId),
  });

  const row = await createProjectRepo(actor.company_id, fields);
  await generateProjectChecklist(Number(row.id), {
    companyId: actor.company_id,
    stage: (row.stage as string | null) ?? null,
  });
  await auditLog({
    actor_id: actor.user_id,
    company_id: actor.company_id,
    entity_type: 'project',
    entity_id: String(row.id),
    action: 'create',
    before: null,
    after: auditSnapshot(row),
  });
  return { ...row, warnings };
}

export async function getProject(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  const project = await getProjectRepo(projectId);
  if (!project) throw new NotFoundError('Not found', 'project');
  return project;
}

export async function updateProject(
  projectId: number | string,
  actor: AccessActor,
  fields: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);

  const current = await getProjectRepo(projectId);
  if (!current) throw new NotFoundError('Not found', 'project');

  const ack = fields.acknowledge_incomplete_mandatory === true;
  const clone = { ...fields };
  delete clone.acknowledge_incomplete_mandatory;

  if (!isCpmo(actor)) {
    delete clone.project_code;
  } else if (typeof clone.project_code === 'string') {
    const newCode = clone.project_code.trim();
    if (!newCode) {
      throw new ValidationError('project_code cannot be empty', 'project_code');
    }
    const currentCode =
      typeof current.project_code === 'string' ? current.project_code.trim() : '';
    if (newCode !== currentCode) {
      const ownerCompanyId =
        (current.company_id as number | null) ?? actor.company_id;
      if (ownerCompanyId == null) {
        throw new ValidationError(
          'project has no company_id; cannot change code',
          'project_code',
        );
      }
      const clash = await findProjectByCompanyCode(ownerCompanyId, newCode);
      if (clash && clash.id !== Number(projectId)) {
        throw new ConflictError('Project code already exists');
      }
      clone.project_code = newCode;
    } else {
      delete clone.project_code;
    }
  }

  const { fields: governed, warnings } = applyProjectGovernance(clone, {
    progress_pct: current.progress_pct as number | null | undefined,
    status: current.status as string | null | undefined,
    rag: current.rag as string | null | undefined,
    stage: current.stage as string | null | undefined,
    status_reason: current.status_reason as string | null | undefined,
  });

  let stageChanged = false;
  if (
    typeof governed.stage === 'string' &&
    String(governed.stage) !== String(current.stage ?? '')
  ) {
    const rows = await listChecklistByProject(Number(projectId));
    const currentStage =
      current.stage == null || current.stage === '' ? 'ALL' : String(current.stage);
    const incomplete = rows.filter(
      (row) =>
        row.catalog_mandatory &&
        row.catalog_stage === currentStage &&
        row.status !== 'approved' &&
        row.status !== 'not_applicable',
    );
    if (incomplete.length > 0 && !ack) {
      throw new MandatoryIncompleteError(
        incomplete.map((row) => ({
          checklist_id: row.id,
          catalog_id: row.catalog_id,
          name: row.catalog_name,
          status: row.status,
        })),
      );
    }
    stageChanged = true;
  }

  const row = await updateProjectRepo(projectId, governed);

  if (
    isCpmo(actor) &&
    governed.project_code !== undefined &&
    governed.project_code !== current.project_code
  ) {
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'project',
      entity_id: String(projectId),
      action: 'code_change',
      before: { project_code: current.project_code },
      after: { project_code: row.project_code },
    });
  }

  const beforeSnap = auditSnapshot(current);
  const afterSnap = auditSnapshot(row);
  if (!snapshotsEqual(beforeSnap, afterSnap)) {
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'project',
      entity_id: String(projectId),
      action: 'update',
      before: beforeSnap,
      after: afterSnap,
    });
  }

  if (stageChanged) {
    const ownerCompanyId = Number(current.company_id);
    if (!Number.isFinite(ownerCompanyId)) {
      throw new ValidationError('project has no company_id; cannot generate checklist', 'company_id');
    }
    await generateProjectChecklist(Number(projectId), {
      companyId: ownerCompanyId,
      stage: String(governed.stage),
    });
  }

  if (stageChanged && ack) {
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'project',
      entity_id: String(projectId),
      action: 'stage_change_ack',
      before: { stage: current.stage },
      after: { stage: governed.stage },
    });
  }

  return { ...row, warnings };
}

export async function deleteProject(projectId: number | string, actor: AccessActor) {
  await assertProjectWriteAccess(projectId, actor);
  const prior = await getProjectRepo(projectId);
  const result = await deleteProjectRepo(projectId);
  if (result.changes !== 0) {
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'project',
      entity_id: String(projectId),
      action: 'delete',
      before: auditSnapshot(prior),
      after: null,
    });
  }
  return result;
}
