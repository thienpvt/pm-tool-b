import { PageChrome } from '@/components/layout/PageChrome';
import ProjectCommunicationPage from '@/modules/projects/ui/communication/ProjectCommunicationPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectCommunicationRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 p-4 lg:p-6 max-w-5xl">
      <ProjectCommunicationPage />
    </PageChrome>
  );
}
