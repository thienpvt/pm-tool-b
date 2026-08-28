import type { PortfolioReportData } from '../types';
import { buildTemplateReportVn } from './buildTemplateReportVn';
import { buildTemplateReportEn } from './buildTemplateReportEn';

export function buildTemplateReport(data: PortfolioReportData, language: string, periodStart: string, periodEnd: string, companyName = '', bugDimension: 'status' | 'severity' = 'severity'): string {
  return language === 'Vietnamese'
    ? buildTemplateReportVn(data, periodStart, periodEnd, companyName, bugDimension)
    : buildTemplateReportEn(data, periodStart, periodEnd, companyName, bugDimension);
}
