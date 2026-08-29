import { PageChrome } from '@/components/layout/PageChrome';
import DocumentCatalogPage from '@/modules/documents/ui/catalog/DocumentCatalogPage';

export default function DocumentCatalogRoute() {
  return (
    <PageChrome mainClassName="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
      <DocumentCatalogPage />
    </PageChrome>
  );
}
