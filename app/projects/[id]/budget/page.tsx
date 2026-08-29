import { PageChrome } from '@/components/layout/PageChrome';
import ProjectBudgetPage from '@/modules/projects/ui/budget/ProjectBudgetPage';

type Props = { params: Promise<{ id: string }> };

export default async function ProjectBudgetRoute({ params }: Props) {
  const { id } = await params;
  return (
    <PageChrome projectId={id} mainClassName="flex-1 p-4 lg:p-6 overflow-auto">
      <ProjectBudgetPage />
    </PageChrome>
  );
}
