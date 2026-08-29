import { PageChrome } from '@/components/layout/PageChrome';
import AuditLogPage from '@/modules/audit/ui/AuditLogPage';

export default function AuditLogRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
      <AuditLogPage />
    </PageChrome>
  );
}
