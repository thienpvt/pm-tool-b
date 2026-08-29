import { PageChrome } from '@/components/layout/PageChrome';
import MilestonesPage from '@/modules/projects/ui/milestones/MilestonesPage';

type Props = { params: Promise<{ id: string }> };

export default async function MilestonesRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 overflow-auto">
      <MilestonesPage />
    </PageChrome>
  );
}
