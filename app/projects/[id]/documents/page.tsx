import { PageChrome } from '@/components/layout/PageChrome';
import ProjectDocumentsPage from '@/modules/projects/ui/documents/ProjectDocumentsPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectDocumentsRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 p-4 lg:p-6">
      <ProjectDocumentsPage />
    </PageChrome>
  );
}
