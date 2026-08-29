import { PageChrome } from '@/components/layout/PageChrome';
import { PageLoadingShell } from '@/components/layout/PageLoadingShell';

export default function PmDashboardLoading() {
  return (
    <PageChrome mainClassName="flex-1 flex items-center justify-center">
      <PageLoadingShell message="Loading dashboard…" />
    </PageChrome>
  );
}
