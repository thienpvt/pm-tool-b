import { PageChrome } from '@/components/layout/PageChrome';
import ProjectReportPage from '@/modules/reports/ui/project-report/ProjectReportPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectReportRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 min-w-0">
      <ProjectReportPage />
    </PageChrome>
  );
}
