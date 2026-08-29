import { PageChrome } from '@/components/layout/PageChrome';
import ResourcesMembersPage from '@/modules/portfolio/ui/members/ResourcesMembersPage';

export default function ResourcesMembersRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 overflow-x-auto">
      <ResourcesMembersPage />
    </PageChrome>
  );
}
