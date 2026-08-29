import { PageChrome } from '@/components/layout/PageChrome';
import ProgramsPage from '@/modules/portfolio/ui/programs/ProgramsPage';

export default function ProgramsRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-8">
      <ProgramsPage />
    </PageChrome>
  );
}
