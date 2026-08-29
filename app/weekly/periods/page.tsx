import { PageChrome } from '@/components/layout/PageChrome';
import WeeklyPeriodsPage from '@/modules/weekly/ui/periods/WeeklyPeriodsPage';

export default function WeeklyPeriodsRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
      <WeeklyPeriodsPage />
    </PageChrome>
  );
}
