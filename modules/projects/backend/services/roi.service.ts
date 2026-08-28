import { listFiscalBudgets } from '@/modules/portfolio/backend/repositories/fiscal-budget.repo';
import { sumAdjustmentsVnd } from '@/modules/projects/backend/repositories/budget-adjustments.repo';
import { listFinancialBenefitsForYear } from '@/modules/projects/backend/repositories/financial-benefits.repo';
import { computeActualRoi, computeExpectedRoi } from '@/lib/fiscal/roi';
import { coerceVndSafe } from '@/lib/fiscal/vnd';
import { assertProjectAccess, type AccessActor } from '@/lib/services/access';

export async function getProjectRoi(
  projectId: number | string,
  actor: AccessActor,
  fiscalYear: number,
) {
  await assertProjectAccess(projectId, actor);

  const budgets = await listFiscalBudgets(projectId);
  const yearRows = budgets.filter((row) => row.fiscal_year === fiscalYear);

  let approvedNet = 0;
  let actualSpend = 0;
  for (const row of yearRows) {
    const adjustments = await sumAdjustmentsVnd(row.id);
    approvedNet += coerceVndSafe(row.approved_amount_vnd, 'approved_amount_vnd') + adjustments;
    actualSpend += coerceVndSafe(row.actual_amount_vnd, 'actual_amount_vnd');
  }

  const benefitRows = await listFinancialBenefitsForYear(projectId, fiscalYear);
  const hasBenefitRow = benefitRows.length > 0;
  const sumExpected = benefitRows.reduce(
    (sum, row) => sum + coerceVndSafe(row.expected_vnd, 'expected_vnd'),
    0,
  );
  const allActualsPresent = benefitRows.every((row) => row.actual_vnd !== null);
  const sumActual = benefitRows.reduce(
    (sum, row) => sum + (row.actual_vnd === null ? 0 : coerceVndSafe(row.actual_vnd, 'actual_vnd')),
    0,
  );

  const expected = computeExpectedRoi(sumExpected, approvedNet, hasBenefitRow);
  const actual = computeActualRoi(sumActual, actualSpend, allActualsPresent, hasBenefitRow);

  return {
    fiscal_year: fiscalYear,
    expected,
    actual,
  };
}
