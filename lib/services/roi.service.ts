import { listFiscalBudgets } from '@/lib/repositories/fiscal-budget.repo';
import { sumAdjustmentsVnd } from '@/lib/repositories/budget-adjustments.repo';
import { listFinancialBenefitsForYear } from '@/lib/repositories/financial-benefits.repo';
import { computeActualRoi, computeExpectedRoi } from '@/lib/fiscal/roi';
import { assertProjectAccess, type AccessActor } from './access';

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
    approvedNet += Number(row.approved_amount_vnd) + adjustments;
    actualSpend += Number(row.actual_amount_vnd);
  }

  const benefitRows = await listFinancialBenefitsForYear(projectId, fiscalYear);
  const hasBenefitRow = benefitRows.length > 0;
  const sumExpected = benefitRows.reduce((sum, row) => sum + Number(row.expected_vnd), 0);
  const allActualsPresent = benefitRows.every((row) => row.actual_vnd !== null);
  const sumActual = benefitRows.reduce(
    (sum, row) => sum + (row.actual_vnd === null ? 0 : Number(row.actual_vnd)),
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
