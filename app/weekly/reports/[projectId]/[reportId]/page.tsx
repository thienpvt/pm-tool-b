import { PageChrome } from '@/components/layout/PageChrome';
import WeeklyReportEditorPage from '@/modules/weekly/ui/report/WeeklyReportEditorPage';

type Props = { params: Promise<{ projectId: string; reportId: string }> };

export default async function WeeklyReportEditorRoute({ params }: Props) {
  const { projectId } = await params;
  return (
    <PageChrome projectId={projectId} mainClassName="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
      <WeeklyReportEditorPage />
    </PageChrome>
  );
}
