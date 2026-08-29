import { PageChrome } from '@/components/layout/PageChrome';
import PortfolioHomePage from '@/modules/portfolio/ui/home/PortfolioHomePage';

export default function HomeRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 overflow-auto">
      <PortfolioHomePage />
    </PageChrome>
  );
}
