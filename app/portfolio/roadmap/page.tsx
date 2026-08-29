import { PageChrome } from '@/components/layout/PageChrome';
import RoadmapPage from '@/modules/portfolio/ui/roadmap/RoadmapPage';

export default function RoadmapRoute() {
  return (
    <PageChrome mainClassName="flex-1 flex flex-col overflow-hidden">
      <RoadmapPage />
    </PageChrome>
  );
}
