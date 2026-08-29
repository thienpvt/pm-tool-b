import { PageChrome } from '@/components/layout/PageChrome';
import PortfolioDashboardPage from '@/modules/dashboards/ui/portfolio/PortfolioDashboardPage';

export default function PortfolioDashboardRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
      <PortfolioDashboardPage />
    </PageChrome>
  );
}
