'use client';
import { useEffect, useState, useMemo } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import OnboardingModal from '@/components/onboarding/OnboardingModal';
import { usePortfolioDashboard } from './usePortfolioDashboard';
import { projectHealthScore } from './_components/helpers';
import { PortfolioHeader } from './_components/PortfolioHeader';
import { ProgramTabs } from './_components/ProgramTabs';
import { KpiCardsRow } from './_components/KpiCardsRow';
import { AnalyticsMiddleRow } from './_components/AnalyticsMiddleRow';
import { RecommendationsRow } from './_components/RecommendationsRow';
import { PortfolioHealthMatrix } from './_components/PortfolioHealthMatrix';
import { ProgramScorecard } from './_components/ProgramScorecard';
import { ProjectsSection } from './_components/ProjectsSection';

export default function PortfolioHomePage() {
  const { data, loading, companyName, meUser, setMeUser, refetch } = usePortfolioDashboard();
  const [selectedProgramId, setSelectedProgramId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards');
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (!loading && data !== null && meUser !== null) {
      if (!meUser.onboarding_completed && data.projects.length === 0) {
        setShowOnboarding(true);
      }
    }
  }, [loading, data, meUser]);

  const activeProgram = useMemo(() => {
    if (selectedProgramId === null || !data) return null;
    return data.programs.find(c => c.id === selectedProgramId) ?? null;
  }, [data, selectedProgramId]);

  const filteredProjects = useMemo(() => {
    if (!data) return [];
    if (selectedProgramId === null) return data.projects;
    if (selectedProgramId === 0) return data.noProgramProjects;
    return activeProgram?.projects ?? [];
  }, [data, selectedProgramId, activeProgram]);

  const analytics = useMemo(() => {
    const ps = filteredProjects;
    const red   = ps.filter(p => p.rag === 'red').length;
    const amber = ps.filter(p => p.rag === 'amber').length;
    const green = ps.filter(p => p.rag === 'green').length;
    const total = ps.length;
    const healthScore = total === 0 ? 0 : Math.round((green * 100 + amber * 55 + red * 15) / total);

    const totalActivities = ps.reduce((s, p) => s + Number(p.total_activities), 0);
    const doneActivities  = ps.reduce((s, p) => s + Number(p.done_activities), 0);
    const inProgress = ps.filter(p => p.current_phase === 'Execution').length;
    const planning   = ps.filter(p => p.current_phase === 'Planning').length;
    const initiation = ps.filter(p => p.current_phase === 'Initiation').length;
    const closing    = ps.filter(p => p.current_phase === 'Closing').length;

    const totalOpenRisks  = ps.reduce((s, p) => s + Number(p.open_risks), 0);
    const totalOpenIssues = ps.reduce((s, p) => s + Number(p.open_issues), 0);
    const avgCompletion   = total ? Math.round(ps.reduce((s, p) => s + Number(p.completion_pct), 0) / total) : 0;
    const overdueCount    = ps.filter(p => p.days_until_deadline !== null && p.days_until_deadline < 0).length;

    const byHealthScore = [...ps]
      .map(p => ({ ...p, hScore: projectHealthScore(p) }))
      .sort((a, b) => b.hScore - a.hScore)
      .slice(0, 8);

    const topRiskyProjects = [...ps]
      .filter(p => p.open_risks > 0 || p.open_issues > 0)
      .sort((a, b) => {
        const order = { red: 0, amber: 1, green: 2 };
        return order[a.rag] - order[b.rag];
      })
      .slice(0, 4);

    return {
      healthScore, red, amber, green, total,
      totalActivities, doneActivities, inProgress, planning, initiation, closing,
      totalOpenRisks, totalOpenIssues, avgCompletion, overdueCount,
      byHealthScore, topRiskyProjects,
      totalPrograms: data?.kpi.totalPrograms ?? 0,
    };
  }, [filteredProjects, data]);

  const filteredPhaseDist = useMemo(() => ['Initiation','Planning','Execution','Closing'].map(phase => ({
    phase, count: filteredProjects.filter(p => p.current_phase === phase).length,
  })), [filteredProjects]);

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading portfolio...</p>
          </div>
        </main>
      </div>
    );
  }
  if (!data) return null;

  const today = new Date();
  const dateStr = today.toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const riskSpark  = [3,5,4,7,6,analytics.totalOpenRisks || 4];
  const issueSpark = [2,3,5,4,3,analytics.totalOpenIssues || 2];
  const progSpark  = [30,38,45,52,60,analytics.avgCompletion || 55];

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      {showOnboarding && meUser && (
        <OnboardingModal
          userName={meUser.display_name || meUser.username || 'there'}
          onComplete={() => {
            setMeUser(u => u ? { ...u, onboarding_completed: 1 } : u);
            setShowOnboarding(false);
            refetch();
          }}
        />
      )}
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="max-w-7xl mx-auto space-y-5">
          <PortfolioHeader dateStr={dateStr} companyName={companyName} activeProgram={activeProgram} />
          <ProgramTabs data={data} selectedProgramId={selectedProgramId} onSelectProgram={setSelectedProgramId} />
          <KpiCardsRow analytics={analytics} riskSpark={riskSpark} issueSpark={issueSpark} progSpark={progSpark} />
          <AnalyticsMiddleRow analytics={analytics} filteredPhaseDist={filteredPhaseDist} filteredProjectsLength={filteredProjects.length} />
          <RecommendationsRow analytics={analytics} />
          <PortfolioHealthMatrix projects={filteredProjects} />
          <ProgramScorecard data={data} />
          <ProjectsSection
            data={data}
            filteredProjects={filteredProjects}
            selectedProgramId={selectedProgramId}
            activeProgram={activeProgram}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />
        </div>
      </main>
    </div>
  );
}
