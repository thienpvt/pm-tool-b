import { PageChrome } from '@/components/layout/PageChrome';
import TimelinePage from '@/modules/projects/ui/timeline/TimelinePage';

type Props = { params: Promise<{ id: string }> };

export default async function TimelineRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 p-4 lg:p-6 overflow-x-auto">
      <TimelinePage />
    </PageChrome>
  );
}
