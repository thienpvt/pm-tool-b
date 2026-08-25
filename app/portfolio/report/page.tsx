'use client';
import { useState } from 'react';
import { Sparkles, TrendingUp } from 'lucide-react';
import Sidebar from '@/components/layout/Sidebar';
import { usePortfolioReport } from './usePortfolioReport';
import { useReportPageActions } from './useReportPageActions';
import type { ProjectRow, SavedPrompt } from './types';
import { getThisMonday, getThisSunday } from './_components/helpers';
import { ReportHeaderKpi } from './_components/ReportHeaderKpi';
import { ReportConfigPanel } from './_components/ReportConfigPanel';
import { ReportPreview } from './_components/ReportPreview';
import { EmailModal } from './_components/EmailModal';

export default function PortfolioReportPage() {
  const [reportMode, setReportMode] = useState<'daterange' | 'milestone'>('daterange');
  const [selectedMilestoneIds, setSelectedMilestoneIds] = useState<Set<number>>(new Set());
  const [periodStart, setPeriodStart] = useState(getThisMonday);
  const [periodEnd, setPeriodEnd] = useState(getThisSunday);
  const [generating, setGenerating] = useState(false);
  const [language, setLanguage] = useState<'Vietnamese' | 'English'>('Vietnamese');
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [bugDimension, setBugDimension] = useState<'status' | 'severity'>('severity');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [showMilestoneSelector, setShowMilestoneSelector] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'source'>('preview');
  const [exporting, setExporting] = useState<'png' | 'pdf' | null>(null);
  const [selectedProgramIds, setSelectedProgramIds] = useState<Set<number>>(new Set());
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<number>>(new Set());
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState<string>('executive');
  const [customPromptText, setCustomPromptText] = useState('');
  const [generatedEmailHtml, setGeneratedEmailHtml] = useState('');
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [savedPrompts, setSavedPrompts] = useState<SavedPrompt[]>([]);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [savePromptName, setSavePromptName] = useState('');

  const {
    data, loading, report, setReport, htmlReport, setHtmlReport,
    apiKeySet, ceoEmail, setCeoEmail, companyName, loadConfig, loadData,
  } = usePortfolioReport({ reportMode, selectedMilestoneIds, periodStart, periodEnd });

  const actions = useReportPageActions({
    data, periodStart, periodEnd, companyName, language, mode, bugDimension,
    selectedProjectIds, selectedPromptId, customPromptText, savedPrompts,
    emailRecipients, emailSubject, generatedEmailHtml, htmlReport, report, viewMode,
    apiKeyInput, ceoEmail, savePromptName, showEmailModal,
    setReport, setHtmlReport, setViewMode, setGenerating, setExporting,
    setShowKeyInput, setApiKeyInput, setSavingKey, setSavingEmail,
    setEmailRecipients, setGeneratedEmailHtml, setEmailSubject,
    setShowSaveInput, setSavePromptName, setCustomPromptText, setShowEmailModal,
    setGeneratingEmail, setSendingEmail, setSavedPrompts,
    setSelectedProgramIds, setSelectedProjectIds, loadConfig,
  });

  const allProjects = data ? [...data.programs.flatMap(c => c.projects), ...data.noProgramProjects] : [];
  const red = allProjects.filter(p => p.rag === 'red');
  const amber = allProjects.filter(p => p.rag === 'amber');
  const green = allProjects.filter(p => p.rag === 'green');

  const projectsInFilter: ProjectRow[] = (() => {
    if (!data || selectedProgramIds.size === 0) return [];
    const result: ProjectRow[] = [];
    for (const prog of data.programs) {
      if (selectedProgramIds.has(prog.id)) result.push(...prog.projects);
    }
    if (selectedProgramIds.has(-1)) result.push(...data.noProgramProjects);
    return result;
  })();

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 overflow-auto">
        <div className="max-w-6xl mx-auto space-y-5">
          <ReportHeaderKpi data={data} companyName={companyName} red={red} amber={amber} green={green} />
          <ReportConfigPanel
            data={data} loading={loading}
            reportMode={reportMode} setReportMode={setReportMode}
            selectedMilestoneIds={selectedMilestoneIds} setSelectedMilestoneIds={setSelectedMilestoneIds}
            showMilestoneSelector={showMilestoneSelector} setShowMilestoneSelector={setShowMilestoneSelector}
            periodStart={periodStart} setPeriodStart={setPeriodStart}
            periodEnd={periodEnd} setPeriodEnd={setPeriodEnd}
            language={language} setLanguage={setLanguage}
            mode={mode} setMode={setMode}
            bugDimension={bugDimension} setBugDimension={setBugDimension}
            apiKeySet={apiKeySet} showKeyInput={showKeyInput} setShowKeyInput={setShowKeyInput}
            apiKeyInput={apiKeyInput} setApiKeyInput={setApiKeyInput}
            savingKey={savingKey} saveApiKey={actions.saveApiKey}
            selectedProgramIds={selectedProgramIds} setSelectedProgramIds={setSelectedProgramIds}
            selectedProjectIds={selectedProjectIds} setSelectedProjectIds={setSelectedProjectIds}
            showProjectSelector={showProjectSelector} setShowProjectSelector={setShowProjectSelector}
            projectsInFilter={projectsInFilter}
            handleGenerate={actions.handleGenerate} generating={generating} loadData={loadData}
          />
          <ReportPreview
            data={data} loading={loading} mode={mode} report={report} setReport={setReport}
            htmlReport={htmlReport} generating={generating} viewMode={viewMode} setViewMode={setViewMode}
            previewRef={actions.previewRef} exporting={exporting} handleGenerate={actions.handleGenerate}
            copyReport={actions.copyReport} exportPng={actions.exportPng} exportPdf={actions.exportPdf}
            exportHtml={actions.exportHtml} exportTxt={actions.exportTxt} openEmailModal={actions.openEmailModal}
            ceoEmail={ceoEmail} setCeoEmail={setCeoEmail} savingEmail={savingEmail} saveCeoEmail={actions.saveCeoEmail}
          />
          <div className={`rounded-xl px-4 py-3 text-xs flex items-start gap-2 border ${mode === 'ai' ? 'bg-violet-50 border-violet-100 text-violet-700' : 'bg-blue-50 border-blue-100 text-blue-700'}`}>
            {mode === 'ai'
              ? <><Sparkles className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span><strong>AI mode:</strong> Claude reads all portfolio data including risks, issues, and milestones, then writes a comprehensive professional report. Requires Anthropic API key.</span></>
              : <><TrendingUp className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span><strong>Template mode:</strong> Automatically aggregates all project data into a structured PMO-grade report — no AI or internet required.</span></>
            }
          </div>
        </div>
      </main>
      <EmailModal
        data={data} companyName={companyName}
        showEmailModal={showEmailModal} setShowEmailModal={setShowEmailModal}
        selectedPromptId={selectedPromptId} setSelectedPromptId={setSelectedPromptId}
        customPromptText={customPromptText} setCustomPromptText={setCustomPromptText}
        savedPrompts={savedPrompts} showSaveInput={showSaveInput} setShowSaveInput={setShowSaveInput}
        savePromptName={savePromptName} setSavePromptName={setSavePromptName}
        savePrompt={actions.savePrompt} deletePrompt={actions.deletePrompt}
        generateEmailContent={actions.generateEmailContent} generatingEmail={generatingEmail}
        generatedEmailHtml={generatedEmailHtml}
        emailSubject={emailSubject} setEmailSubject={setEmailSubject}
        emailRecipients={emailRecipients} setEmailRecipients={setEmailRecipients}
        sendEmailViaApi={actions.sendEmailViaApi} sendingEmail={sendingEmail}
      />
    </div>
  );
}
