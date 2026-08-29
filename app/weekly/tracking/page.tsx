import { PageChrome } from '@/components/layout/PageChrome';
import WeeklyTrackingPage from '@/modules/weekly/ui/tracking/WeeklyTrackingPage';

export default function WeeklyTrackingRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
      <WeeklyTrackingPage />
    </PageChrome>
  );
}
