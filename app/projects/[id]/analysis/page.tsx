import { PageChrome } from '@/components/layout/PageChrome';
import ProjectAnalysisPage from '@/modules/projects/ui/analysis/ProjectAnalysisPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectAnalysisRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 p-4 lg:p-6 overflow-x-auto">
      <ProjectAnalysisPage />
    </PageChrome>
  );
}
