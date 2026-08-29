import { PageChrome } from '@/components/layout/PageChrome';
import ProjectHubPage from '@/modules/projects/ui/hub/ProjectHubPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectHubRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 p-4 lg:p-8 max-w-5xl">
      <ProjectHubPage />
    </PageChrome>
  );
}
