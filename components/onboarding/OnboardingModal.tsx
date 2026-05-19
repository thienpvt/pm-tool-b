'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Building2, FolderKanban, TrendingUp, CheckCircle2,
  ArrowRight, ChevronRight, Check,
} from 'lucide-react';

function KoinoboriIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M7 14 C7 7 20 6 22 12 L22 16 C20 22 7 21 7 14Z" fill="#fb923c" />
      <circle cx="7" cy="14" r="3.5" fill="none" stroke="#fb923c" strokeWidth="2" />
      <path d="M12 10 A3 3 0 0 1 17 10" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" fill="none" />
      <path d="M10 14 A3 3 0 0 1 15 14" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" fill="none" />
      <path d="M15 14 A3 3 0 0 1 20 14" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" fill="none" />
      <path d="M12 18 A3 3 0 0 1 17 18" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" fill="none" />
      <path d="M22 12 L28 7 L25 14 L28 21 L22 16Z" fill="#fb923c" />
      <circle cx="10" cy="11" r="2" fill="white" />
      <circle cx="10.5" cy="11.5" r="1" fill="#1e293b" />
    </svg>
  );
}

const INDUSTRIES = [
  'Banking & Finance', 'Insurance', 'Fintech', 'Retail', 'Healthcare',
  'Manufacturing', 'Telecommunications', 'Government', 'Education', 'Technology', 'Other',
];

type Step = 'welcome' | 'customer' | 'project' | 'done';

// ─── Step Progress Dots ────────────────────────────────────────────────────────
function StepDots({ current }: { current: 1 | 2 }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2].map(i => (
        <div key={i} className="flex items-center gap-2">
          <div className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200',
            i < current ? 'bg-blue-600 text-white' :
            i === current ? 'bg-blue-600 text-white ring-4 ring-blue-100' :
            'bg-slate-100 text-slate-400',
          )}>
            {i < current ? <Check className="h-3.5 w-3.5" /> : i}
          </div>
          {i < 2 && (
            <div className={cn(
              'h-0.5 w-10 rounded-full transition-colors duration-200',
              current > 1 ? 'bg-blue-600' : 'bg-slate-200',
            )} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Welcome Step ──────────────────────────────────────────────────────────────
function WelcomeStep({
  userName,
  onStart,
  onSkipAll,
  finishing,
}: {
  userName: string;
  onStart: () => void;
  onSkipAll: () => void;
  finishing: boolean;
}) {
  return (
    <>
      {/* Gradient header */}
      <div className="relative bg-gradient-to-br from-slate-800 via-slate-900 to-blue-900 px-6 sm:px-8 pt-8 pb-7 overflow-hidden shrink-0">
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '22px 22px' }}
        />
        <div className="relative">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 bg-white/15 rounded-2xl flex items-center justify-center backdrop-blur-sm shrink-0">
              <KoinoboriIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] text-white/50 font-semibold uppercase tracking-widest">PM Tool</p>
              <p className="text-white font-bold text-sm leading-tight">Project Manager</p>
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
            Welcome aboard,{' '}
            <span className="text-orange-400">{userName}</span>! 👋
          </h1>
          <p className="text-white/60 text-sm mt-2 leading-relaxed">
            Let&apos;s set up your workspace in just 2 quick steps.
          </p>
        </div>
      </div>

      {/* Feature highlights */}
      <div className="px-6 sm:px-8 py-5 space-y-2.5 flex-1">
        {[
          {
            icon: Building2,
            color: 'text-blue-600 bg-blue-50 border-blue-100',
            label: 'Program Management',
            desc: 'Organize programs and link all their projects.',
          },
          {
            icon: FolderKanban,
            color: 'text-violet-600 bg-violet-50 border-violet-100',
            label: 'Project Tracking',
            desc: 'Monitor progress, risks, and deliverables.',
          },
          {
            icon: TrendingUp,
            color: 'text-green-600 bg-green-50 border-green-100',
            label: 'Portfolio Analytics',
            desc: "Bird-eye view of your entire portfolio's health.",
          },
        ].map(({ icon: Icon, color, label, desc }) => (
          <div key={label} className={cn('flex items-center gap-3.5 p-3 rounded-xl border', color.split(' ').slice(2).join(' '), 'bg-slate-50/60 border-slate-100')}>
            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', color.split(' ').slice(0, 2).join(' '))}>
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{label}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="px-6 sm:px-8 pb-7 pt-3 flex flex-col gap-3 shrink-0">
        <Button
          onClick={onStart}
          className="w-full bg-blue-600 hover:bg-blue-700 gap-2 h-11 text-[15px] font-semibold"
        >
          Get Started <ArrowRight className="h-4 w-4" />
        </Button>
        <button
          onClick={onSkipAll}
          disabled={finishing}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors py-1.5 disabled:opacity-50"
        >
          {finishing ? 'Loading…' : 'Skip setup — go straight to dashboard'}
        </button>
      </div>
    </>
  );
}

// ─── Customer Step ─────────────────────────────────────────────────────────────
type CustomerForm = { name: string; industry: string; contact_name: string; contact_email: string; contact_phone: string };

function CustomerStep({
  form,
  setForm,
  onSave,
  onSkip,
  saving,
}: {
  form: CustomerForm;
  setForm: React.Dispatch<React.SetStateAction<CustomerForm>>;
  onSave: () => void;
  onSkip: () => void;
  saving: boolean;
}) {
  const set = (k: keyof CustomerForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      {/* Header */}
      <div className="px-6 sm:px-8 pt-6 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-5">
          <StepDots current={1} />
          <span className="text-xs text-slate-400 font-medium">Step 1 of 2</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center shrink-0">
            <Building2 className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Add your first program</h2>
            <p className="text-xs text-slate-500">Link your projects to a program</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-6 sm:px-8 pb-2 space-y-3.5 flex-1 overflow-y-auto">
        <div>
          <Label className="text-xs font-semibold text-slate-600">
            Program Name <span className="text-red-500">*</span>
          </Label>
          <Input
            className="mt-1.5 h-9"
            placeholder="e.g. VPBank, Techcombank…"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            onKeyDown={e => e.key === 'Enter' && onSave()}
            autoFocus
          />
        </div>
        <div>
          <Label className="text-xs font-semibold text-slate-600">Industry</Label>
          <select
            className="mt-1.5 w-full h-9 px-3 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.industry}
            onChange={e => set('industry', e.target.value)}
          >
            <option value="">Select industry…</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs font-semibold text-slate-600">Contact Person</Label>
            <Input
              className="mt-1.5 h-9"
              placeholder="Nguyễn Văn A"
              value={form.contact_name}
              onChange={e => set('contact_name', e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs font-semibold text-slate-600">Phone</Label>
            <Input
              className="mt-1.5 h-9"
              placeholder="+84 xxx xxx xxx"
              value={form.contact_phone}
              onChange={e => set('contact_phone', e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label className="text-xs font-semibold text-slate-600">Contact Email</Label>
          <Input
            className="mt-1.5 h-9"
            type="email"
            placeholder="contact@company.com"
            value={form.contact_email}
            onChange={e => set('contact_email', e.target.value)}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 sm:px-8 py-5 flex flex-col gap-3 shrink-0">
        <Button
          onClick={onSave}
          disabled={saving}
          className="w-full bg-blue-600 hover:bg-blue-700 gap-2 h-10"
        >
          {saving ? 'Creating…' : <><span>Create Program</span><ChevronRight className="h-4 w-4" /></>}
        </Button>
        <button
          onClick={onSkip}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors py-1.5"
        >
          Skip — I&apos;ll add programs later
        </button>
      </div>
    </>
  );
}

// ─── Project Step ──────────────────────────────────────────────────────────────
type ProjectForm = { name: string; description: string; current_phase: string };

function ProjectStep({
  form,
  setForm,
  customer,
  onSave,
  onSkip,
  saving,
}: {
  form: ProjectForm;
  setForm: React.Dispatch<React.SetStateAction<ProjectForm>>;
  customer: { id: number; name: string } | null;
  onSave: () => void;
  onSkip: () => void;
  saving: boolean;
}) {
  const set = (k: keyof ProjectForm, v: string) => setForm(f => ({ ...f, [k]: v }));

  return (
    <>
      {/* Header */}
      <div className="px-6 sm:px-8 pt-6 pb-4 shrink-0">
        <div className="flex items-center justify-between mb-5">
          <StepDots current={2} />
          <span className="text-xs text-slate-400 font-medium">Step 2 of 2</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
            <FolderKanban className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Create your first project</h2>
            <p className="text-xs text-slate-500">Start tracking progress right away</p>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="px-6 sm:px-8 pb-2 space-y-3.5 flex-1 overflow-y-auto">
        {customer && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-blue-50 border border-blue-100">
            <Building2 className="h-3.5 w-3.5 text-blue-500 shrink-0" />
            <p className="text-xs text-blue-700">
              Linked to <span className="font-semibold">{customer.name}</span>
            </p>
          </div>
        )}
        <div>
          <Label className="text-xs font-semibold text-slate-600">
            Project Name <span className="text-red-500">*</span>
          </Label>
          <Input
            className="mt-1.5 h-9"
            placeholder="e.g. Core Banking Platform Upgrade"
            value={form.name}
            onChange={e => set('name', e.target.value)}
            autoFocus
          />
        </div>
        <div>
          <Label className="text-xs font-semibold text-slate-600">Description</Label>
          <Textarea
            className="mt-1.5 text-sm min-h-[72px] resize-none"
            placeholder="Brief description of the project scope…"
            value={form.description}
            onChange={e => set('description', e.target.value)}
          />
        </div>
        <div>
          <Label className="text-xs font-semibold text-slate-600">Current Phase</Label>
          <select
            className="mt-1.5 w-full h-9 px-3 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={form.current_phase}
            onChange={e => set('current_phase', e.target.value)}
          >
            <option value="Initiation">Initiation</option>
            <option value="Planning">Planning</option>
            <option value="Execution">Execution</option>
            <option value="Closing">Closing</option>
          </select>
        </div>
      </div>

      {/* Actions */}
      <div className="px-6 sm:px-8 py-5 flex flex-col gap-3 shrink-0">
        <Button
          onClick={onSave}
          disabled={saving}
          className="w-full bg-violet-600 hover:bg-violet-700 gap-2 h-10"
        >
          {saving ? 'Creating…' : <><span>Create Project</span><ChevronRight className="h-4 w-4" /></>}
        </Button>
        <button
          onClick={onSkip}
          className="text-xs text-slate-400 hover:text-slate-600 transition-colors py-1.5"
        >
          Skip — I&apos;ll add projects later
        </button>
      </div>
    </>
  );
}

// ─── Done Step ─────────────────────────────────────────────────────────────────
function DoneStep({
  createdCustomer,
  createdProject,
  onFinish,
  finishing,
}: {
  createdCustomer: { id: number; name: string } | null;
  createdProject: { id: number; name: string } | null;
  onFinish: () => void;
  finishing: boolean;
}) {
  const hasCreated = createdCustomer || createdProject;
  return (
    <div className="px-6 sm:px-8 py-10 flex flex-col items-center text-center flex-1">
      {/* Checkmark */}
      <div className="relative mb-5">
        <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center border-4 border-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-500" />
        </div>
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-orange-400 rounded-full flex items-center justify-center text-white text-xs">
          🎉
        </div>
      </div>

      <h2 className="text-2xl font-bold text-slate-800 mb-2">You&apos;re all set!</h2>
      <p className="text-slate-500 text-sm mb-6 max-w-xs leading-relaxed">
        {hasCreated
          ? "Here's what was created. You can always add more from the dashboard."
          : "No worries — you can always add programs and projects from the dashboard anytime."}
      </p>

      {/* Created items summary */}
      {hasCreated && (
        <div className="w-full space-y-2 mb-6 text-left">
          {createdCustomer && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-50 border border-blue-100">
              <div className="w-7 h-7 bg-blue-100 rounded-lg flex items-center justify-center shrink-0">
                <Building2 className="h-3.5 w-3.5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-blue-500 font-semibold uppercase tracking-wide">Program created</p>
                <p className="text-sm font-bold text-blue-800 truncate">{createdCustomer.name}</p>
              </div>
              <Check className="h-4 w-4 text-blue-500 shrink-0" />
            </div>
          )}
          {createdProject && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-violet-50 border border-violet-100">
              <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                <FolderKanban className="h-3.5 w-3.5 text-violet-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-violet-500 font-semibold uppercase tracking-wide">Project created</p>
                <p className="text-sm font-bold text-violet-800 truncate">{createdProject.name}</p>
              </div>
              <Check className="h-4 w-4 text-violet-500 shrink-0" />
            </div>
          )}
        </div>
      )}

      <Button
        onClick={onFinish}
        disabled={finishing}
        className="w-full bg-blue-600 hover:bg-blue-700 gap-2 h-11 text-[15px] font-semibold"
      >
        {finishing ? 'Loading…' : <><span>Go to Dashboard</span><ArrowRight className="h-4 w-4" /></>}
      </Button>
    </div>
  );
}

// ─── Main OnboardingModal ──────────────────────────────────────────────────────
export default function OnboardingModal({
  userName,
  onComplete,
}: {
  userName: string;
  onComplete: () => void;
}) {
  const [step, setStep] = useState<Step>('welcome');
  const [finishing, setFinishing] = useState(false);

  const [customerForm, setCustomerForm] = useState<CustomerForm>({
    name: '', industry: '', contact_name: '', contact_email: '', contact_phone: '',
  });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [createdCustomer, setCreatedCustomer] = useState<{ id: number; name: string } | null>(null);

  const [projectForm, setProjectForm] = useState<ProjectForm>({
    name: '', description: '', current_phase: 'Initiation',
  });
  const [savingProject, setSavingProject] = useState(false);
  const [createdProject, setCreatedProject] = useState<{ id: number; name: string } | null>(null);

  const finish = useCallback(async () => {
    setFinishing(true);
    await fetch('/api/auth/complete-onboarding', { method: 'POST' });
    onComplete();
  }, [onComplete]);

  const handleCreateCustomer = async () => {
    if (!customerForm.name.trim()) { toast.error('Program name is required'); return; }
    setSavingCustomer(true);
    const res = await fetch('/api/programs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customerForm),
    });
    setSavingCustomer(false);
    if (!res.ok) { toast.error('Failed to create program'); return; }
    const data = await res.json();
    setCreatedCustomer({ id: data.id, name: customerForm.name });
    toast.success('Program created!');
    setStep('project');
  };

  const handleCreateProject = async () => {
    if (!projectForm.name.trim()) { toast.error('Project name is required'); return; }
    setSavingProject(true);
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...projectForm,
        customer_id: createdCustomer?.id ?? null,
        client: createdCustomer?.name ?? '',
      }),
    });
    setSavingProject(false);
    if (!res.ok) { toast.error('Failed to create project'); return; }
    const data = await res.json();
    setCreatedProject({ id: data.id, name: projectForm.name });
    setStep('done');
  };

  return (
    /* Overlay — bottom-sheet on mobile, centered on sm+ */
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-[480px] bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden">
        {step === 'welcome' && (
          <WelcomeStep
            userName={userName}
            onStart={() => setStep('customer')}
            onSkipAll={finish}
            finishing={finishing}
          />
        )}
        {step === 'customer' && (
          <CustomerStep
            form={customerForm}
            setForm={setCustomerForm}
            onSave={handleCreateCustomer}
            onSkip={() => setStep('project')}
            saving={savingCustomer}
          />
        )}
        {step === 'project' && (
          <ProjectStep
            form={projectForm}
            setForm={setProjectForm}
            customer={createdCustomer}
            onSave={handleCreateProject}
            onSkip={() => setStep('done')}
            saving={savingProject}
          />
        )}
        {step === 'done' && (
          <DoneStep
            createdCustomer={createdCustomer}
            createdProject={createdProject}
            onFinish={finish}
            finishing={finishing}
          />
        )}
      </div>
    </div>
  );
}
