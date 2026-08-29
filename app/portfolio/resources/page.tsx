import { PageChrome } from '@/components/layout/PageChrome';
import PortfolioResourcesPage from '@/modules/portfolio/ui/resources/PortfolioResourcesPage';

export default function PortfolioResourcesRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 overflow-x-auto">
      <PortfolioResourcesPage />
    </PageChrome>
  );
}
