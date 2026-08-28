import {
  getFinancialBenefitInProject as getFinancialBenefitInProjectRepo,
  insertFinancialBenefit as insertFinancialBenefitRepo,
  listFinancialBenefits as listFinancialBenefitsRepo,
  updateFinancialBenefit as updateFinancialBenefitRepo,
  type FinancialBenefitRow,
  type BenefitType,
} from '@/lib/repositories/financial-benefits.repo';
import {
  getNonfinancialBenefitInProject as getNonfinancialBenefitInProjectRepo,
  insertNonfinancialBenefit as insertNonfinancialBenefitRepo,
  listNonfinancialBenefits as listNonfinancialBenefitsRepo,
  updateNonfinancialBenefit as updateNonfinancialBenefitRepo,
  type NonfinancialBenefitRow,
} from '@/lib/repositories/nonfinancial-benefits.repo';
import { parseFiscalYear, parseNonNegativeVnd } from '@/lib/fiscal/vnd';
import { assertProjectAccess, assertProjectWriteAccess, type AccessActor } from './access';
import { auditLog } from './audit.service';
import { ConflictError, NotFoundError, ValidationError } from './errors';

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object'
    && err !== null
    && 'code' in err
    && (err as { code: string }).code === '23505'
  );
}

function parseBenefitType(value: unknown): BenefitType {
  if (value !== 'COST_SAVING' && value !== 'REVENUE' && value !== 'PRODUCTIVITY') {
    throw new ValidationError('benefit_type must be COST_SAVING, REVENUE, or PRODUCTIVITY', 'benefit_type');
  }
  return value;
}

function financialBenefitSnapshot(row: FinancialBenefitRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    fiscal_year: row.fiscal_year,
    benefit_type: row.benefit_type,
    expected_vnd: Number(row.expected_vnd),
    actual_vnd: row.actual_vnd === null ? null : Number(row.actual_vnd),
  };
}

function nonfinancialBenefitSnapshot(row: NonfinancialBenefitRow | null | undefined) {
  if (!row) return null;
  return {
    id: row.id,
    project_id: row.project_id,
    group_name: row.group_name,
    measure: row.measure,
    target: row.target,
    actual_text: row.actual_text,
  };
}

export async function listProjectBenefits(projectId: number | string, actor: AccessActor) {
  await assertProjectAccess(projectId, actor);
  const [financial, nonfinancial] = await Promise.all([
    listFinancialBenefitsRepo(projectId),
    listNonfinancialBenefitsRepo(projectId),
  ]);
  return { financial, nonfinancial };
}

export async function createProjectBenefit(
  projectId: number | string,
  actor: AccessActor,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const kind = body.kind;

  if (kind === 'financial') {
    const fiscalYear = parseFiscalYear(body.fiscal_year);
    const benefitType = parseBenefitType(body.benefit_type);
    const expectedVnd = parseNonNegativeVnd(body.expected_vnd, 'expected_vnd');

    const insertBody: {
      fiscal_year: number;
      benefit_type: string;
      expected_vnd: number;
      actual_vnd?: number | null;
    } = {
      fiscal_year: fiscalYear,
      benefit_type: benefitType,
      expected_vnd: expectedVnd,
    };

    if ('actual_vnd' in body) {
      insertBody.actual_vnd =
        body.actual_vnd === null
          ? null
          : parseNonNegativeVnd(body.actual_vnd, 'actual_vnd');
    } else {
      insertBody.actual_vnd = null;
    }

    try {
      const created = (await insertFinancialBenefitRepo(projectId, insertBody)) as FinancialBenefitRow;
      await auditLog({
        actor_id: actor.user_id,
        company_id: actor.company_id,
        entity_type: 'financial_benefit',
        entity_id: String(created.id),
        action: 'create',
        before: null,
        after: financialBenefitSnapshot(created),
      });
      return created;
    } catch (err) {
      if (isUniqueViolation(err)) {
        throw new ConflictError('Financial benefit already exists for this year and type');
      }
      throw err;
    }
  }

  if (kind === 'nonfinancial') {
    const groupName = typeof body.group_name === 'string' ? body.group_name.trim() : '';
    const measure = typeof body.measure === 'string' ? body.measure.trim() : '';
    const target = typeof body.target === 'string' ? body.target.trim() : '';
    if (!groupName || !measure || !target) {
      throw new ValidationError('group_name, measure, and target are required', 'group_name');
    }

    const insertBody: {
      group_name: string;
      measure: string;
      target: string;
      actual_text?: string | null;
    } = { group_name: groupName, measure, target };

    if ('actual_text' in body) {
      insertBody.actual_text =
        body.actual_text === null || body.actual_text === undefined
          ? null
          : String(body.actual_text);
    }

    const created = (await insertNonfinancialBenefitRepo(projectId, insertBody)) as NonfinancialBenefitRow;
    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'nonfinancial_benefit',
      entity_id: String(created!.id),
      action: 'create',
      before: null,
      after: nonfinancialBenefitSnapshot(created),
    });
    return created;
  }

  throw new ValidationError('kind must be financial or nonfinancial', 'kind');
}

export async function patchProjectBenefit(
  projectId: number | string,
  actor: AccessActor,
  benefitId: number | string,
  body: Record<string, unknown>,
) {
  await assertProjectWriteAccess(projectId, actor);
  const kind = body.kind;

  if (kind === 'financial') {
    const before = (await getFinancialBenefitInProjectRepo(projectId, benefitId)) as
      | FinancialBenefitRow
      | undefined;
    if (!before) throw new NotFoundError('Not found', 'financial_benefit');

    const patch: { expected_vnd?: number; actual_vnd?: number | null } = {};
    if (body.expected_vnd !== undefined) {
      patch.expected_vnd = parseNonNegativeVnd(body.expected_vnd, 'expected_vnd');
    }
    if ('actual_vnd' in body) {
      patch.actual_vnd =
        body.actual_vnd === null
          ? null
          : parseNonNegativeVnd(body.actual_vnd, 'actual_vnd');
    }

    const after = (await updateFinancialBenefitRepo(projectId, benefitId, patch)) as
      | FinancialBenefitRow
      | undefined;
    if (!after) throw new NotFoundError('Not found', 'financial_benefit');

    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'financial_benefit',
      entity_id: String(benefitId),
      action: 'update',
      before: financialBenefitSnapshot(before),
      after: financialBenefitSnapshot(after),
    });
    return after;
  }

  if (kind === 'nonfinancial') {
    const before = (await getNonfinancialBenefitInProjectRepo(projectId, benefitId)) as
      | NonfinancialBenefitRow
      | undefined;
    if (!before) throw new NotFoundError('Not found', 'nonfinancial_benefit');

    const patch: { actual_text?: string | null } = {};
    if ('actual_text' in body) {
      patch.actual_text =
        body.actual_text === null || body.actual_text === undefined
          ? null
          : String(body.actual_text);
    }

    const after = (await updateNonfinancialBenefitRepo(projectId, benefitId, patch)) as
      | NonfinancialBenefitRow
      | undefined;
    if (!after) throw new NotFoundError('Not found', 'nonfinancial_benefit');

    await auditLog({
      actor_id: actor.user_id,
      company_id: actor.company_id,
      entity_type: 'nonfinancial_benefit',
      entity_id: String(benefitId),
      action: 'update',
      before: nonfinancialBenefitSnapshot(before),
      after: nonfinancialBenefitSnapshot(after),
    });
    return after;
  }

  throw new ValidationError('kind must be financial or nonfinancial', 'kind');
}
