import { PageChrome } from '@/components/layout/PageChrome';
import ProjectDashboardPage from '@/modules/projects/ui/dashboard/ProjectDashboardPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectDashboardRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 p-4 lg:p-6 overflow-x-auto space-y-5">
      <ProjectDashboardPage />
    </PageChrome>
  );
}
