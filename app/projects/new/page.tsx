import { PageChrome } from '@/components/layout/PageChrome';
import NewProjectPage from '@/modules/projects/ui/new/NewProjectPage';

export default function NewProjectRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-8 max-w-2xl">
      <NewProjectPage />
    </PageChrome>
  );
}
