import { PageChrome } from '@/components/layout/PageChrome';
import PortfolioReportPage from '@/modules/reports/ui/portfolio-report/PortfolioReportPage';

export default function PortfolioReportRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 overflow-auto">
      <PortfolioReportPage />
    </PageChrome>
  );
}
