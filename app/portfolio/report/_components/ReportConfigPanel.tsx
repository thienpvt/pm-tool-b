'use client';
import type { PortfolioReportData, ProjectRow } from '../types';
import { ReportPeriodPanel } from './ReportPeriodPanel';
import { ReportControlsPanel } from './ReportControlsPanel';

export type ReportConfigPanelProps = {
  data: PortfolioReportData | null;
  loading: boolean;
  reportMode: 'daterange' | 'milestone';
  setReportMode: (m: 'daterange' | 'milestone') => void;
  selectedMilestoneIds: Set<number>;
  setSelectedMilestoneIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  showMilestoneSelector: boolean;
  setShowMilestoneSelector: React.Dispatch<React.SetStateAction<boolean>>;
  periodStart: string;
  setPeriodStart: (v: string) => void;
  periodEnd: string;
  setPeriodEnd: (v: string) => void;
  language: 'Vietnamese' | 'English';
  setLanguage: (l: 'Vietnamese' | 'English') => void;
  mode: 'manual' | 'ai';
  setMode: (m: 'manual' | 'ai') => void;
  bugDimension: 'status' | 'severity';
  setBugDimension: (d: 'status' | 'severity') => void;
  apiKeySet: false | 'db' | 'env';
  showKeyInput: boolean;
  setShowKeyInput: React.Dispatch<React.SetStateAction<boolean>>;
  apiKeyInput: string;
  setApiKeyInput: (v: string) => void;
  savingKey: boolean;
  saveApiKey: () => void;
  selectedProgramIds: Set<number>;
  setSelectedProgramIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  selectedProjectIds: Set<number>;
  setSelectedProjectIds: React.Dispatch<React.SetStateAction<Set<number>>>;
  showProjectSelector: boolean;
  setShowProjectSelector: React.Dispatch<React.SetStateAction<boolean>>;
  projectsInFilter: ProjectRow[];
  handleGenerate: () => void;
  generating: boolean;
  loadData: () => void;
};

export function ReportConfigPanel(props: ReportConfigPanelProps) {
  return (
    <>
      <ReportPeriodPanel
        data={props.data}
        loading={props.loading}
        reportMode={props.reportMode}
        setReportMode={props.setReportMode}
        selectedMilestoneIds={props.selectedMilestoneIds}
        setSelectedMilestoneIds={props.setSelectedMilestoneIds}
        showMilestoneSelector={props.showMilestoneSelector}
        setShowMilestoneSelector={props.setShowMilestoneSelector}
        periodStart={props.periodStart}
        setPeriodStart={props.setPeriodStart}
        periodEnd={props.periodEnd}
        setPeriodEnd={props.setPeriodEnd}
        loadData={props.loadData}
      />
      <ReportControlsPanel
        data={props.data}
        loading={props.loading}
        language={props.language}
        setLanguage={props.setLanguage}
        mode={props.mode}
        setMode={props.setMode}
        bugDimension={props.bugDimension}
        setBugDimension={props.setBugDimension}
        apiKeySet={props.apiKeySet}
        showKeyInput={props.showKeyInput}
        setShowKeyInput={props.setShowKeyInput}
        apiKeyInput={props.apiKeyInput}
        setApiKeyInput={props.setApiKeyInput}
        savingKey={props.savingKey}
        saveApiKey={props.saveApiKey}
        selectedProgramIds={props.selectedProgramIds}
        setSelectedProgramIds={props.setSelectedProgramIds}
        selectedProjectIds={props.selectedProjectIds}
        setSelectedProjectIds={props.setSelectedProjectIds}
        showProjectSelector={props.showProjectSelector}
        setShowProjectSelector={props.setShowProjectSelector}
        projectsInFilter={props.projectsInFilter}
        handleGenerate={props.handleGenerate}
        generating={props.generating}
      />
    </>
  );
}
