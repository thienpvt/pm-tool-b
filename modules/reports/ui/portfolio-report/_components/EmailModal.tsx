'use client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Mail, Sparkles, Loader2 } from 'lucide-react';
import type { PortfolioReportData, SavedPrompt } from '../types';
import { MAX_SAVED_PROMPTS } from '../types';
import { EMAIL_PROMPT_TEMPLATES } from './EmailPromptTemplates';

export type EmailModalProps = {
  data: PortfolioReportData | null;
  companyName: string;
  showEmailModal: boolean;
  setShowEmailModal: (v: boolean) => void;
  selectedPromptId: string;
  setSelectedPromptId: (id: string) => void;
  customPromptText: string;
  setCustomPromptText: (v: string) => void;
  savedPrompts: SavedPrompt[];
  showSaveInput: boolean;
  setShowSaveInput: React.Dispatch<React.SetStateAction<boolean>>;
  savePromptName: string;
  setSavePromptName: (v: string) => void;
  savePrompt: () => void;
  deletePrompt: (id: string) => void;
  generateEmailContent: () => void;
  generatingEmail: boolean;
  generatedEmailHtml: string;
  emailSubject: string;
  setEmailSubject: (v: string) => void;
  emailRecipients: string;
  setEmailRecipients: (v: string) => void;
  sendEmailViaApi: () => void;
  sendingEmail: boolean;
};

export function EmailModal(props: EmailModalProps) {
  if (!props.showEmailModal) return null;
  const {
    data, companyName, setShowEmailModal, selectedPromptId, setSelectedPromptId,
    customPromptText, setCustomPromptText, savedPrompts, showSaveInput, setShowSaveInput,
    savePromptName, setSavePromptName, savePrompt, deletePrompt, generateEmailContent,
    generatingEmail, generatedEmailHtml, emailSubject, setEmailSubject,
    emailRecipients, setEmailRecipients, sendEmailViaApi, sendingEmail,
  } = props;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl h-[90vh] flex flex-col">
    
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
    <h3 className="text-base font-bold text-slate-800 flex items-center gap-2">
    <Mail className="h-4 w-4 text-blue-600" />
    Soạn & Gửi Email Báo Cáo Portfolio
    </h3>
    <button
    onClick={() => setShowEmailModal(false)}
    className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors text-lg leading-none"
    >
    ×
    </button>
    </div>
    
    {/* 2-column body */}
    <div className="flex flex-1 min-h-0 overflow-hidden">
    
    {/* ── Left panel: Prompt config ─────────────────────────────── */}
    <div className="w-[420px] shrink-0 border-r overflow-y-auto bg-slate-50/60 flex flex-col">
    <div className="p-5 space-y-5 flex-1">
    
    {/* Template selector */}
    <div>
    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 block">
    Loại email
    </label>
    <div className="space-y-1.5">
    {EMAIL_PROMPT_TEMPLATES.map(t => (
    <button
    key={t.id}
    onClick={() => { setSelectedPromptId(t.id); setCustomPromptText(t.instruction); }}
    className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all ${selectedPromptId === t.id ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
    >
    <div className="flex items-center gap-2">
    <span className="text-base leading-none">{t.icon}</span>
    <span className="text-xs font-semibold text-slate-700">{t.label}</span>
    {selectedPromptId === t.id && <span className="ml-auto text-[11px] text-blue-600 font-bold">✓</span>}
    </div>
    <p className="text-[11px] text-slate-400 leading-tight mt-1 pl-6">{t.description}</p>
    </button>
    ))}
    </div>
    </div>
    
    {/* Saved prompts */}
    {savedPrompts.length > 0 && (
    <div>
    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
    Đã lưu ({savedPrompts.length}/{MAX_SAVED_PROMPTS})
    </label>
    <div className="space-y-1.5">
    {savedPrompts.map(p => (
    <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white group hover:border-slate-300 transition-colors">
    <span className="text-xs text-slate-600 font-medium flex-1 truncate">{p.name}</span>
    <button
    onClick={() => { setCustomPromptText(p.text); toast.success(`Đã tải: "${p.name}"`); }}
    className="text-[11px] text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded bg-blue-50 hover:bg-blue-100 shrink-0 transition-colors"
    >
    Dùng
    </button>
    <button
    onClick={() => deletePrompt(p.id)}
    className="text-slate-300 hover:text-red-500 shrink-0 transition-colors opacity-0 group-hover:opacity-100 text-base leading-none"
    title="Xóa"
    >
    ×
    </button>
    </div>
    ))}
    </div>
    </div>
    )}
    
    {/* Custom instruction textarea */}
    <div className="flex-1">
    <div className="flex items-center justify-between mb-2">
    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
    Lệnh tùy chỉnh
    </label>
    <button
    onClick={() => { setShowSaveInput(v => !v); setSavePromptName(''); }}
    disabled={savedPrompts.length >= MAX_SAVED_PROMPTS && !showSaveInput}
    title={savedPrompts.length >= MAX_SAVED_PROMPTS ? `Tối đa ${MAX_SAVED_PROMPTS} prompt` : 'Lưu prompt hiện tại'}
    className="text-[11px] text-slate-500 hover:text-blue-600 flex items-center gap-1 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
    💾 {showSaveInput ? 'Hủy' : `Lưu (${savedPrompts.length}/${MAX_SAVED_PROMPTS})`}
    </button>
    </div>
    {showSaveInput && (
    <div className="flex gap-1.5 mb-2">
    <Input
    className="h-7 text-xs flex-1"
    placeholder="Đặt tên để nhớ..."
    value={savePromptName}
    onChange={e => setSavePromptName(e.target.value)}
    onKeyDown={e => e.key === 'Enter' && savePrompt()}
    autoFocus
    />
    <Button
    onClick={savePrompt}
    disabled={!savePromptName.trim() || !customPromptText.trim()}
    className="h-7 text-xs px-3 bg-blue-600 hover:bg-blue-700"
    >
    Lưu
    </Button>
    </div>
    )}
    <Textarea
    className="text-xs font-mono resize-y border-slate-200 bg-white min-h-[220px]"
    value={customPromptText}
    onChange={e => setCustomPromptText(e.target.value)}
    placeholder="Chọn loại email ở trên để tải lệnh mẫu, hoặc nhập lệnh tùy chỉnh..."
    />
    <p className="text-[11px] text-slate-400 mt-1.5">
    Lệnh này được gửi cho Claude cùng dữ liệu portfolio để soạn email.
    </p>
    </div>
    
    </div>
    </div>
    
    {/* ── Right panel: Generate + Preview + Send ────────────────── */}
    <div className="flex-1 min-w-0 overflow-y-auto flex flex-col">
    <div className="p-6 flex flex-col gap-5 flex-1">
    
    {/* Generate button */}
    <Button
    onClick={generateEmailContent}
    disabled={generatingEmail || !data}
    className="w-full gap-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 h-11 text-sm font-semibold"
    >
    {generatingEmail
    ? <><Loader2 className="h-4 w-4 animate-spin" /> Claude đang soạn email...</>
    : <><Sparkles className="h-4 w-4" /> Tạo nội dung email với Claude</>
    }
    </Button>
    
    {/* Loading */}
    {generatingEmail && (
    <div className="flex-1 flex items-center justify-center py-16">
    <div className="text-center">
    <Sparkles className="h-10 w-10 text-violet-300 mx-auto mb-4 animate-pulse" />
    <p className="text-sm font-medium text-slate-600 mb-1">Claude đang soạn email báo cáo...</p>
    <p className="text-xs text-slate-400">Phân tích {data?.kpi.totalProjects} dự án, {data?.topRisks.length} rủi ro</p>
    </div>
    </div>
    )}
    
    {/* Empty state */}
    {!generatedEmailHtml && !generatingEmail && (
    <div className="flex-1 flex items-center justify-center py-12">
    <div className="text-center max-w-sm">
    <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
    <Sparkles className="h-7 w-7 text-violet-300" />
    </div>
    <p className="text-sm font-semibold text-slate-600 mb-2">Chưa có nội dung email</p>
    <p className="text-xs text-slate-400 leading-relaxed">
    Chọn loại email ở bên trái, tùy chỉnh lệnh nếu cần, rồi nhấn{' '}
    <span className="font-medium text-violet-600">Tạo nội dung email</span> để Claude soạn thảo.
    </p>
    </div>
    </div>
    )}
    
    {/* Preview */}
    {generatedEmailHtml && !generatingEmail && (
    <div className="flex flex-col flex-1 min-h-0">
    <div className="flex items-center justify-between mb-2">
    <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
    Xem trước nội dung email
    </label>
    <span className="text-[11px] text-green-600 font-medium flex items-center gap-1">
    ✓ Đã tạo xong
    </span>
    </div>
    <div
    className="border border-slate-200 rounded-xl overflow-auto bg-white flex-1"
    style={{ minHeight: '300px' }}
    dangerouslySetInnerHTML={{ __html: generatedEmailHtml }}
    />
    </div>
    )}
    
    {/* Subject + Recipients + Send */}
    {generatedEmailHtml && !generatingEmail && (
    <div className="space-y-3 pt-4 border-t border-slate-100 shrink-0">
    <div className="grid grid-cols-1 gap-3">
    <div>
    <label className="text-xs font-medium text-slate-500 mb-1.5 block">Tiêu đề email</label>
    <Input
    className="h-9 text-sm"
    value={emailSubject}
    onChange={e => setEmailSubject(e.target.value)}
    placeholder={`[${companyName || 'PMO'}] Báo cáo Portfolio...`}
    />
    </div>
    <div>
    <label className="text-xs font-medium text-slate-500 mb-1.5 block">
    Gửi đến
    <span className="text-slate-400 font-normal ml-1">(nhiều email cách nhau bằng dấu phẩy)</span>
    </label>
    <Input
    className="h-9 text-sm"
    placeholder="ceo@company.com, director@company.com"
    value={emailRecipients}
    onChange={e => setEmailRecipients(e.target.value)}
    />
    </div>
    </div>
    <Button
    onClick={sendEmailViaApi}
    disabled={sendingEmail || !emailRecipients.trim()}
    className="w-full h-10 gap-2 text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
    >
    {sendingEmail
    ? <><Loader2 className="h-4 w-4 animate-spin" /> Đang gửi email...</>
    : <><Mail className="h-4 w-4" /> Gửi Email Báo Cáo</>
    }
    </Button>
    </div>
    )}
    
    </div>
    </div>
    </div>
    
    {/* Footer */}
    <div className="flex items-center justify-between px-6 py-3 border-t bg-slate-50/50 rounded-b-2xl shrink-0">
    <p className="text-[11px] text-slate-400">
    Email được tạo bởi Claude từ dữ liệu portfolio thực tế · RESEND_API_KEY required
    </p>
    <Button
    variant="outline"
    onClick={() => setShowEmailModal(false)}
    disabled={sendingEmail}
    className="h-8 text-xs"
    >
    Đóng
    </Button>
    </div>
    
      </div>
    </div>
  );
}
