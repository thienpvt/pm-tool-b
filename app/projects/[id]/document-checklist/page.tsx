import { PageChrome } from '@/components/layout/PageChrome';
import ProjectChecklistPage from '@/modules/documents/ui/checklist/ProjectChecklistPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectChecklistRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
      <ProjectChecklistPage />
    </PageChrome>
  );
}
