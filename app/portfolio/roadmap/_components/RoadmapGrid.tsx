'use client';
import type { EpicDetailData, EpicNode, MilestoneItem, MilestoneRow, ProgramGroup } from '../types';
import { RoadmapPhaseGrid } from './RoadmapPhaseGrid';
import { RoadmapMilestoneView, type MilestoneComputed } from './RoadmapMilestoneView';

export type RoadmapGridProps = {
  viewMode: 'phase' | 'milestone';
  groups: ProgramGroup[];
  tl: { months: { label: string; quarter: string; start: Date; end: Date }[]; todayPct: number };
  selectedYear: number;
  openSet: Set<number>;
  expandedPhases: Set<string>;
  epicsByProject: Record<number, EpicNode[] | 'loading'>;
  roadmapRef: React.RefObject<HTMLDivElement | null>;
  rawPct: (dateStr: string, eod?: boolean) => number;
  onToggleProgram: (id: number) => void;
  onTogglePhaseExpand: (projectId: number, phase: string) => void;
  onEpicDetail: (detail: EpicDetailData) => void;
  milestones: MilestoneRow[] | null;
  selectedMilestoneId: number | null;
  onSelectMilestone: (id: number | null) => void;
  selectedMilestone: MilestoneRow | null;
  ms: MilestoneComputed | null;
  collapsedMsEpics: Set<number>;
  onToggleMsEpic: (epicId: number) => void;
};

export function RoadmapGrid(props: RoadmapGridProps) {
  if (props.viewMode === 'phase') {
    return (
      <RoadmapPhaseGrid
        groups={props.groups}
        tl={props.tl}
        selectedYear={props.selectedYear}
        openSet={props.openSet}
        expandedPhases={props.expandedPhases}
        epicsByProject={props.epicsByProject}
        roadmapRef={props.roadmapRef}
        rawPct={props.rawPct}
        onToggleProgram={props.onToggleProgram}
        onTogglePhaseExpand={props.onTogglePhaseExpand}
        onEpicDetail={props.onEpicDetail}
      />
    );
  }

  return (
    <RoadmapMilestoneView
      milestones={props.milestones}
      selectedMilestoneId={props.selectedMilestoneId}
      onSelectMilestone={props.onSelectMilestone}
      selectedMilestone={props.selectedMilestone}
      ms={props.ms}
      collapsedMsEpics={props.collapsedMsEpics}
      onToggleMsEpic={props.onToggleMsEpic}
      onEpicDetail={props.onEpicDetail}
    />
  );
}
