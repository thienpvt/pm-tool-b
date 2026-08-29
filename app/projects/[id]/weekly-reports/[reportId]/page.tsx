import { PageChrome } from '@/components/layout/PageChrome';
import WeeklyReportEditorPage from '@/modules/weekly/ui/report/WeeklyReportEditorPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectWeeklyReportRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
      <WeeklyReportEditorPage />
    </PageChrome>
  );
}
