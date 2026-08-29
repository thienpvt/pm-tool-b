'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { useProjectReport } from './useProjectReport';
import { useProjectReportPageActions } from './useProjectReportPageActions';
import { getThisMonday, getThisSunday } from './_components/helpers';
import { ReportHeaderKpi } from './_components/ReportHeaderKpi';
import { ReportToolbar } from './_components/ReportToolbar';
import { ReportPreview } from './_components/ReportPreview';
import { EmailModal } from './_components/EmailModal';

export default function ProjectReportPage() {
  const { id } = useParams<{ id: string }>();

  const [reportMode, setReportMode] = useState<'daterange' | 'milestone'>('daterange');
  const [periodStart, setPeriodStart] = useState(getThisMonday);
  const [periodEnd, setPeriodEnd] = useState(getThisSunday);
  const [selectedMilestoneId, setSelectedMilestoneId] = useState('');
  const [showMilestoneSelector, setShowMilestoneSelector] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'source' | 'ai'>('preview');
  const [mode, setMode] = useState<'manual' | 'ai'>('manual');
  const [language, setLanguage] = useState<'Vietnamese' | 'English'>('Vietnamese');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [savingKey, setSavingKey] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailRecipients, setEmailRecipients] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [selectedPromptId, setSelectedPromptId] = useState('executive');
  const [customPromptText, setCustomPromptText] = useState('');
  const [generatedEmailHtml, setGeneratedEmailHtml] = useState('');
  const [generatingEmail, setGeneratingEmail] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [savePromptName, setSavePromptName] = useState('');
  const [exporting, setExporting] = useState<'pdf' | null>(null);

  const {
    data, loading, report, setReport, htmlReport, setHtmlReport, aiReport, setAiReport,
    apiKeySet, pmEmail, setPmEmail, companyName, savedPrompts, setSavedPrompts,
    loadConfig, loadData, generateAiReport, generateEmailContent, sendEmailViaApi,
  } = useProjectReport({ projectId: id, reportMode, periodStart, periodEnd, selectedMilestoneId });

  const actions = useProjectReportPageActions({
    data, report, htmlReport, aiReport, viewMode, mode, language, companyName, pmEmail,
    apiKeyInput, emailRecipients, emailSubject, generatedEmailHtml, selectedPromptId, customPromptText,
    savedPrompts, savePromptName, setReport, setHtmlReport, setAiReport, setViewMode, setGenerating,
    setExporting, setShowKeyInput, setApiKeyInput, setSavingKey, setSavingEmail, setEmailRecipients,
    setGeneratedEmailHtml, setEmailSubject, setShowSaveInput, setSavePromptName, setCustomPromptText,
    setSelectedPromptId, setShowEmailModal, setGeneratingEmail, setSendingEmail, setSavedPrompts, loadConfig,
    generateAiReport, generateEmailContent, sendEmailViaApi,
  });

  return (
    <>
        <ReportHeaderKpi data={data} />
        <div className="flex flex-col lg:flex-row gap-0 flex-1">
          <ReportToolbar
            data={data} loading={loading}
            reportMode={reportMode} setReportMode={setReportMode}
            periodStart={periodStart} setPeriodStart={setPeriodStart}
            periodEnd={periodEnd} setPeriodEnd={setPeriodEnd}
            selectedMilestoneId={selectedMilestoneId} setSelectedMilestoneId={setSelectedMilestoneId}
            showMilestoneSelector={showMilestoneSelector} setShowMilestoneSelector={setShowMilestoneSelector}
            loadData={loadData} language={language} setLanguage={setLanguage}
            mode={mode} setMode={setMode} generating={generating} handleGenerate={actions.handleGenerate}
            hasReport={actions.hasReport} htmlReport={htmlReport} report={report} aiReport={aiReport}
            viewMode={viewMode} setViewMode={setViewMode} copyReport={actions.copyReport}
            exportHtml={actions.exportHtml} exportTxt={actions.exportTxt} exportPdf={actions.exportPdf}
            exporting={exporting} openEmailModal={actions.openEmailModal}
            apiKeySet={apiKeySet} showKeyInput={showKeyInput} setShowKeyInput={setShowKeyInput}
            apiKeyInput={apiKeyInput} setApiKeyInput={setApiKeyInput} savingKey={savingKey}
            saveApiKey={actions.saveApiKey} pmEmail={pmEmail} setPmEmail={setPmEmail}
            savingEmail={savingEmail} savePmEmail={actions.savePmEmail}
          >
            <ReportPreview
              previewRef={actions.previewRef} hasReport={actions.hasReport} viewMode={viewMode}
              report={report} activeView={actions.activeView}
            />
          </ReportToolbar>
        </div>
<EmailModal
        showEmailModal={showEmailModal} setShowEmailModal={setShowEmailModal}
        emailRecipients={emailRecipients} setEmailRecipients={setEmailRecipients}
        emailSubject={emailSubject} setEmailSubject={setEmailSubject}
        selectedPromptId={selectedPromptId} setSelectedPromptId={setSelectedPromptId}
        customPromptText={customPromptText} setCustomPromptText={setCustomPromptText}
        savedPrompts={savedPrompts} showSaveInput={showSaveInput} setShowSaveInput={setShowSaveInput}
        savePromptName={savePromptName} setSavePromptName={setSavePromptName}
        savePrompt={actions.savePrompt} deletePrompt={actions.deletePrompt}
        generateEmail={actions.generateEmail} generatingEmail={generatingEmail} apiKeySet={apiKeySet}
        generatedEmailHtml={generatedEmailHtml} sendEmail={actions.sendEmail} sendingEmail={sendingEmail}
      />
    </>
  );
}
