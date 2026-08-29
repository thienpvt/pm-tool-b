import { PageChrome } from '@/components/layout/PageChrome';
import ProjectsListPage from '@/modules/projects/ui/list/ProjectsListPage';

export default function ProjectsListRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-8">
      <ProjectsListPage />
    </PageChrome>
  );
}
