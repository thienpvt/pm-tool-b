import { PageChrome } from '@/components/layout/PageChrome';
import ProjectBugsPage from '@/modules/projects/ui/bugs/ProjectBugsPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectBugsRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 overflow-auto">
      <ProjectBugsPage />
    </PageChrome>
  );
}
