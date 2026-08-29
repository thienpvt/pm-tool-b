import { PageChrome } from '@/components/layout/PageChrome';
import DocumentCompliancePage from '@/modules/documents/ui/compliance/DocumentCompliancePage';

export default function DocumentComplianceRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
      <DocumentCompliancePage />
    </PageChrome>
  );
}
