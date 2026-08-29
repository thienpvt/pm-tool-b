import { PageChrome } from '@/components/layout/PageChrome';
import AdminPage from '@/modules/admin/ui/AdminPage';

export default function AdminRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6">
      <AdminPage />
    </PageChrome>
  );
}
