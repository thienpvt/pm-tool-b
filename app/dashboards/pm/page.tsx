import { PageChrome } from '@/components/layout/PageChrome';
import PmDashboardPage from '@/modules/dashboards/ui/pm/PmDashboardPage';

export default function PmDashboardRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
      <PmDashboardPage />
    </PageChrome>
  );
}
