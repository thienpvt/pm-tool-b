'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Mail, Sparkles, Loader2, Copy } from 'lucide-react';
import type { SavedPrompt } from '../types';
import { EMAIL_PROMPT_TEMPLATES } from './EmailPrompts';

export type EmailModalProps = {
  showEmailModal: boolean;
  setShowEmailModal: (v: boolean) => void;
  emailRecipients: string;
  setEmailRecipients: (v: string) => void;
  emailSubject: string;
  setEmailSubject: (v: string) => void;
  selectedPromptId: string;
  setSelectedPromptId: (v: string) => void;
  customPromptText: string;
  setCustomPromptText: (v: string) => void;
  savedPrompts: SavedPrompt[];
  showSaveInput: boolean;
  setShowSaveInput: React.Dispatch<React.SetStateAction<boolean>>;
  savePromptName: string;
  setSavePromptName: (v: string) => void;
  savePrompt: () => void;
  deletePrompt: (id: string) => void;
  generateEmail: () => void;
  generatingEmail: boolean;
  apiKeySet: false | 'db' | 'env';
  generatedEmailHtml: string;
  sendEmail: () => void;
  sendingEmail: boolean;
};

export function EmailModal(props: EmailModalProps) {
  if (!props.showEmailModal) return null;
  const {
    setShowEmailModal, emailRecipients, setEmailRecipients, emailSubject, setEmailSubject,
    selectedPromptId, setSelectedPromptId, customPromptText, setCustomPromptText, savedPrompts,
    showSaveInput, setShowSaveInput, savePromptName, setSavePromptName, savePrompt, deletePrompt,
    generateEmail, generatingEmail, apiKeySet, generatedEmailHtml, sendEmail, sendingEmail,
  } = props;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-violet-600" />
            <h2 className="font-semibold text-slate-900 text-sm">Send Email Report</h2>
          </div>
          <button onClick={() => setShowEmailModal(false)} className="text-slate-400 hover:text-slate-600 text-lg leading-none">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Recipients */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Recipients (comma-separated)</label>
            <Input value={emailRecipients} onChange={e => setEmailRecipients(e.target.value)} placeholder="sponsor@company.com, pm@company.com" className="text-sm" />
          </div>

          {/* Subject */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-1">Subject</label>
            <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} className="text-sm" />
          </div>

          {/* Prompt template selector */}
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">Email style (Claude will write the email)</label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {EMAIL_PROMPT_TEMPLATES.map(t => (
                <button key={t.id} onClick={() => { setSelectedPromptId(t.id); setCustomPromptText(''); }}
                  className={`text-left px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${selectedPromptId === t.id && !customPromptText ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Custom prompt */}
            <div>
              <label className="text-xs text-slate-500 block mb-1">Or write custom instruction:</label>
              <Textarea value={customPromptText} onChange={e => setCustomPromptText(e.target.value)}
                placeholder="Describe how Claude should write this email…" rows={3} className="text-xs resize-none" />
              {customPromptText && (
                <div className="flex items-center gap-2 mt-1.5">
                  {!showSaveInput ? (
                    <button onClick={() => setShowSaveInput(true)} className="text-xs text-violet-600 hover:underline">Save prompt</button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <Input value={savePromptName} onChange={e => setSavePromptName(e.target.value)} placeholder="Prompt name…" className="h-6 text-xs w-32" />
                      <Button size="sm" onClick={savePrompt} className="h-6 text-xs px-2 bg-violet-600 hover:bg-violet-700">Save</Button>
                      <button onClick={() => setShowSaveInput(false)} className="text-xs text-slate-400">Cancel</button>
                    </div>
                  )}
                </div>
              )}
              {savedPrompts.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {savedPrompts.map(p => (
                    <div key={p.id} className="flex items-center gap-1 bg-slate-100 rounded px-2 py-0.5">
                      <button onClick={() => { setCustomPromptText(p.text); setSelectedPromptId(''); }} className="text-xs text-slate-600 hover:text-violet-600">{p.name}</button>
                      <button onClick={() => deletePrompt(p.id)} className="text-slate-300 hover:text-red-400 text-xs leading-none">×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Generate with Claude */}
          <Button onClick={generateEmail} disabled={generatingEmail || !apiKeySet}
            className="w-full gap-2 bg-violet-600 hover:bg-violet-700">
            {generatingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {generatingEmail ? 'Claude is writing…' : 'Generate Email with Claude'}
          </Button>
          {!apiKeySet && <p className="text-xs text-center text-slate-400">Configure Anthropic API key first</p>}

          {/* Preview */}
          {generatedEmailHtml && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-medium text-slate-600">Email Preview</label>
                <button onClick={() => navigator.clipboard.writeText(generatedEmailHtml).then(() => toast.success('Copied'))}
                  className="text-xs text-violet-600 hover:underline flex items-center gap-1">
                  <Copy className="h-3 w-3" /> Copy HTML
                </button>
              </div>
              <div className="border rounded-lg overflow-hidden max-h-64 overflow-y-auto bg-white">
                <div className="p-4 text-sm" dangerouslySetInnerHTML={{ __html: generatedEmailHtml }} />
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => setShowEmailModal(false)} className="text-sm">Cancel</Button>
          <Button onClick={sendEmail} disabled={sendingEmail || !generatedEmailHtml || !emailRecipients}
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-sm">
            {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            {sendingEmail ? 'Sending…' : 'Send Email'}
          </Button>
        </div>
      </div>
    </div>
  );
}
