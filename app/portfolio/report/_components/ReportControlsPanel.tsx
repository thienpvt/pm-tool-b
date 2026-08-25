'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { KeyRound, ChevronDown, Filter, Sparkles, Eye } from 'lucide-react';
import type { PortfolioReportData, ProjectRow } from '../types';
import { RAG_DOT } from './helpers';

export type ReportControlsPanelProps = {
  data: PortfolioReportData | null;
  loading: boolean;
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
};

export function ReportControlsPanel(props: ReportControlsPanelProps) {
  const {
    data, loading, language, setLanguage, mode, setMode, bugDimension, setBugDimension,
    apiKeySet, showKeyInput, setShowKeyInput, apiKeyInput, setApiKeyInput, savingKey, saveApiKey,
    selectedProgramIds, setSelectedProgramIds, selectedProjectIds, setSelectedProjectIds,
    showProjectSelector, setShowProjectSelector, projectsInFilter, handleGenerate, generating,
  } = props;

  return (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={language} onValueChange={v => setLanguage((v ?? 'Vietnamese') as 'Vietnamese' | 'English')}>
          <SelectTrigger className="w-40 h-9 text-sm bg-slate-50"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Vietnamese">🇻🇳 Tiếng Việt</SelectItem>
            <SelectItem value="English">🇬🇧 English</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500 font-medium">Bug chart:</span>
          <div className="flex items-center bg-slate-100 rounded-lg p-0.5 gap-0.5">
            <button onClick={() => setBugDimension('severity')} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${bugDimension === 'severity' ? 'bg-white shadow text-violet-700' : 'text-slate-400 hover:text-slate-600'}`}>Severity</button>
            <button onClick={() => setBugDimension('status')} className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${bugDimension === 'status' ? 'bg-white shadow text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}>Status</button>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex items-center bg-slate-100 rounded-lg p-1 gap-1">
            <button onClick={() => setMode('manual')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'manual' ? 'bg-white shadow text-slate-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <Eye className="h-3.5 w-3.5" /> Template
            </button>
            <button onClick={() => setMode('ai')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'ai' ? 'bg-white shadow text-violet-700' : 'text-slate-400 hover:text-slate-600'}`}>
              <Sparkles className="h-3.5 w-3.5" /> AI (Claude)
            </button>
          </div>
          <Button onClick={handleGenerate} disabled={generating || loading || !data} className={`h-9 gap-2 text-sm ${mode === 'ai' ? 'bg-violet-600 hover:bg-violet-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
            {mode === 'ai'
              ? <><Sparkles className={`h-3.5 w-3.5 ${generating ? 'animate-pulse' : ''}`} />{generating ? 'Generating...' : 'Generate AI'}</>
              : <><Eye className="h-3.5 w-3.5" />Generate Report</>
            }
          </Button>
        </div>
      </div>

      {data && data.programs.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide shrink-0">Program:</span>
            <div className="flex flex-wrap gap-1.5">
              {data.programs.map(prog => {
                const isSel = selectedProgramIds.has(prog.id);
                return (
                  <button
                    key={prog.id}
                    onClick={() => {
                      const nextProgIds = new Set(selectedProgramIds);
                      if (isSel) {
                        nextProgIds.delete(prog.id);
                        setSelectedProjectIds(prev => { const next = new Set(prev); prog.projects.forEach(p => next.delete(p.id)); return next; });
                      } else {
                        nextProgIds.add(prog.id);
                        setSelectedProjectIds(prev => { const next = new Set(prev); prog.projects.forEach(p => next.add(p.id)); return next; });
                      }
                      setSelectedProgramIds(nextProgIds);
                    }}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${isSel ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                  >
                    {prog.name}
                    <span className={`ml-1 text-[10px] ${isSel ? 'text-blue-100' : 'text-slate-400'}`}>({prog.projects.length})</span>
                  </button>
                );
              })}
              {data.noProgramProjects.length > 0 && (
                <button
                  onClick={() => {
                    const nextProgIds = new Set(selectedProgramIds);
                    if (nextProgIds.has(-1)) {
                      nextProgIds.delete(-1);
                      setSelectedProjectIds(prev => { const next = new Set(prev); data.noProgramProjects.forEach(p => next.delete(p.id)); return next; });
                    } else {
                      nextProgIds.add(-1);
                      setSelectedProjectIds(prev => { const next = new Set(prev); data.noProgramProjects.forEach(p => next.add(p.id)); return next; });
                    }
                    setSelectedProgramIds(nextProgIds);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-colors ${selectedProgramIds.has(-1) ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  Khác
                  <span className={`ml-1 text-[10px] ${selectedProgramIds.has(-1) ? 'text-blue-100' : 'text-slate-400'}`}>({data.noProgramProjects.length})</span>
                </button>
              )}
            </div>
          </div>

          {selectedProgramIds.size > 0 && projectsInFilter.length > 0 && (
            <div className="pl-5">
              <button onClick={() => setShowProjectSelector(v => !v)} className="flex items-center gap-2 w-full text-left group">
                <span className="text-sm font-medium text-slate-600 group-hover:text-slate-800">Squad/Dự án đưa vào báo cáo</span>
                <span className={`ml-1 text-xs px-2 py-0.5 rounded-full font-semibold border ${selectedProjectIds.size < projectsInFilter.length ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                  {selectedProjectIds.size} / {projectsInFilter.length}
                </span>
                <ChevronDown className={`h-4 w-4 text-slate-400 ml-auto transition-transform duration-200 ${showProjectSelector ? 'rotate-180' : ''}`} />
              </button>
              {showProjectSelector && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setSelectedProjectIds(new Set(projectsInFilter.map(p => p.id)))} className="text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium">Chọn tất cả</button>
                    <span className="text-slate-200">|</span>
                    <button onClick={() => setSelectedProjectIds(new Set())} className="text-xs text-slate-400 hover:text-slate-600 hover:underline">Bỏ chọn tất cả</button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 max-h-60 overflow-y-auto pr-1">
                    {projectsInFilter.map(p => {
                      const checked = selectedProjectIds.has(p.id);
                      return (
                        <label key={p.id} className={`flex items-center gap-2.5 px-3 py-2 rounded-lg border cursor-pointer transition-colors text-xs ${checked ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={e => {
                              setSelectedProjectIds(prev => {
                                const next = new Set(prev);
                                e.target.checked ? next.add(p.id) : next.delete(p.id);
                                return next;
                              });
                            }}
                            className="w-3.5 h-3.5 rounded accent-blue-600 shrink-0"
                          />
                          <span className={`w-2 h-2 rounded-full shrink-0 ${RAG_DOT[p.rag]}`} />
                          <span className={`truncate font-medium ${checked ? 'text-slate-800' : 'text-slate-500'}`}>{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {mode === 'ai' && (
        <div className={`rounded-lg px-4 py-3 text-xs flex items-center gap-3 flex-wrap border ${apiKeySet ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          <KeyRound className={`h-4 w-4 shrink-0 ${apiKeySet ? 'text-green-600' : 'text-amber-500'}`} />
          {apiKeySet === 'env' && <span className="text-green-700 font-medium">API key from environment ✓</span>}
          {apiKeySet === 'db' && <span className="text-green-700 font-medium">Anthropic API key configured ✓</span>}
          {!apiKeySet && (
            <>
              <span className="text-amber-700">API key not configured.</span>
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-blue-600 underline font-medium">Get key at console.anthropic.com →</a>
            </>
          )}
          {apiKeySet !== 'env' && (
            <button onClick={() => setShowKeyInput(v => !v)} className="underline text-slate-500 hover:text-slate-700 ml-auto">
              {apiKeySet ? 'Change key' : 'Enter key'}
            </button>
          )}
          {showKeyInput && (
            <div className="w-full flex gap-2 mt-1">
              <Input className="h-8 text-xs font-mono flex-1" type="password" placeholder="sk-ant-api03-..." value={apiKeyInput} onChange={e => setApiKeyInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveApiKey()} />
              <Button onClick={saveApiKey} disabled={savingKey} className="h-8 text-xs bg-green-600 hover:bg-green-700 shrink-0">{savingKey ? 'Saving...' : 'Save'}</Button>
              <Button variant="outline" onClick={() => setShowKeyInput(false)} className="h-8 text-xs shrink-0">Cancel</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
