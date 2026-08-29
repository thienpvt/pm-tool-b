import { PageChrome } from '@/components/layout/PageChrome';
import ProjectResourcesPage from '@/modules/projects/ui/resources/ProjectResourcesPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectResourcesRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 p-4 lg:p-6 overflow-x-auto">
      <ProjectResourcesPage />
    </PageChrome>
  );
}
