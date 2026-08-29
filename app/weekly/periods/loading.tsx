import { PageChrome } from '@/components/layout/PageChrome';
import { PageLoadingShell } from '@/components/layout/PageLoadingShell';

export default function WeeklyPeriodsLoading() {
  return (
    <PageChrome mainClassName="flex-1 flex items-center justify-center">
      <PageLoadingShell message="Loading weekly periods…" />
    </PageChrome>
  );
}
