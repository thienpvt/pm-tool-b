import { PageChrome } from '@/components/layout/PageChrome';
import ProjectRisksPage from '@/modules/projects/ui/risks/ProjectRisksPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectRisksRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 p-4 lg:p-6">
      <ProjectRisksPage />
    </PageChrome>
  );
}
