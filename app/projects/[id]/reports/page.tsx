import { PageChrome } from '@/components/layout/PageChrome';
import ProjectReportsListPage from '@/modules/reports/ui/project-reports-list/ProjectReportsListPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectReportsListRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 overflow-auto p-4 lg:p-5">
      <ProjectReportsListPage />
    </PageChrome>
  );
}
