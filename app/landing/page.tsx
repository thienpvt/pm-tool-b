'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3, ShieldAlert, FileBarChart2, Calendar, Users,
  DollarSign, ChevronRight, CheckCircle2, Menu, X,
  TrendingUp, Target, Zap, ArrowRight, Activity, Download, Sparkles,
  ClipboardList,
} from 'lucide-react';

function KoinoboriIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M7 14 C7 7 20 6 22 12 L22 16 C20 22 7 21 7 14Z" fill="#f97316" />
      <circle cx="7" cy="14" r="3.5" fill="none" stroke="#f97316" strokeWidth="2" />
      <path d="M12 10 A3 3 0 0 1 17 10" stroke="rgba(255,255,255,0.65)" strokeWidth="1.3" fill="none" />
      <path d="M10 14 A3 3 0 0 1 15 14" stroke="rgba(255,255,255,0.65)" strokeWidth="1.3" fill="none" />
      <path d="M15 14 A3 3 0 0 1 20 14" stroke="rgba(255,255,255,0.65)" strokeWidth="1.3" fill="none" />
      <path d="M12 18 A3 3 0 0 1 17 18" stroke="rgba(255,255,255,0.65)" strokeWidth="1.3" fill="none" />
      <path d="M22 12 L28 7 L25 14 L28 21 L22 16Z" fill="#f97316" />
      <circle cx="10" cy="11" r="2" fill="white" />
      <circle cx="10.5" cy="11.5" r="1" fill="#1e293b" />
    </svg>
  );
}

const FEATURES = [
  {
    icon: BarChart3,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    title: 'Portfolio Health Dashboard',
    desc: 'Real-time RAG status, health scores, and AI-powered recommendations across your entire project portfolio — all in one view.',
  },
  {
    icon: ShieldAlert,
    color: 'text-red-500',
    bg: 'bg-red-50',
    title: 'Risk & Issue Management',
    desc: 'Track, categorize, and resolve risks before they derail your projects. Escalation workflows keep stakeholders informed.',
  },
  {
    icon: FileBarChart2,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    title: 'AI-Powered Reports',
    desc: 'Generate executive summaries and portfolio reports in seconds. Powered by Claude AI — clear, qualitative, and board-ready.',
  },
  {
    icon: Calendar,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    title: 'Timeline & Activities',
    desc: 'Plan phases, assign deliverables, and track completion with a full activity timeline. Import from Excel in one click.',
  },
  {
    icon: Users,
    color: 'text-green-600',
    bg: 'bg-green-50',
    title: 'Resource Planning',
    desc: 'Visualize team capacity across domains. Know who is stretched and where to rebalance before it becomes a problem.',
  },
  {
    icon: DollarSign,
    color: 'text-cyan-600',
    bg: 'bg-cyan-50',
    title: 'Budget & Cost Tracking',
    desc: 'Monitor planned vs. actual spend at project and portfolio level. Catch budget drift early with variance indicators.',
  },
];


const CAPABILITIES = [
  { icon: BarChart3,  value: '360°',    label: 'Portfolio visibility', sub: 'All projects. One dashboard.' },
  { icon: Activity,   value: 'RAG',     label: 'Health scoring',       sub: 'Red · Amber · Green status' },
  { icon: Sparkles,   value: 'AI',      label: 'Report generation',    sub: 'Claude-powered summaries' },
  { icon: Download,   value: '1-click', label: 'PDF / PPT export',     sub: 'Board-ready in seconds' },
];

const EMPTY_DEMO = { full_name: '', phone: '', email: '', company_name: '' };

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoForm, setDemoForm] = useState(EMPTY_DEMO);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoSuccess, setDemoSuccess] = useState(false);

  const submitDemo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demoForm.full_name.trim() || !demoForm.phone.trim() || !demoForm.email.trim() || !demoForm.company_name.trim()) return;
    setDemoLoading(true);
    try {
      const res = await fetch('/api/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(demoForm),
      });
      if (res.ok) {
        setDemoSuccess(true);
        setDemoForm(EMPTY_DEMO);
      }
    } finally {
      setDemoLoading(false);
    }
  };

  const openDemo = () => { setDemoSuccess(false); setDemoForm(EMPTY_DEMO); setDemoOpen(true); };

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased">

      {/* ── Navbar ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/landing" className="flex items-center gap-2.5">
            <div className="bg-orange-500/15 rounded-xl p-2">
              <KoinoboriIcon className="h-6 w-6" />
            </div>
            <span className="text-xl font-bold text-slate-900 tracking-tight">Gambaru</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How it works</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <button
              onClick={openDemo}
              className="px-5 py-2 text-sm font-semibold text-blue-600 border border-blue-200 hover:bg-blue-50 rounded-lg transition-colors"
            >
              Đăng ký trải nghiệm
            </button>
            <Link
              href="/login"
              className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg text-slate-500 hover:bg-slate-100"
            onClick={() => setMobileOpen(o => !o)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white px-4 py-4 flex flex-col gap-3">
            <a href="#features" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-slate-700">Features</a>
            <a href="#how-it-works" onClick={() => setMobileOpen(false)} className="py-2 text-sm font-medium text-slate-700">How it works</a>
            <button onClick={() => { setMobileOpen(false); openDemo(); }} className="mt-1 text-center py-2.5 text-sm font-semibold text-blue-600 border border-blue-200 rounded-lg">
              Đăng ký trải nghiệm
            </button>
            <Link href="/login" className="text-center py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg">
              Sign In
            </Link>
          </div>
        )}
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-[#0f172a]">
        {/* Background gradient blobs */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px]" />
          <div className="absolute -bottom-20 right-0 w-[500px] h-[500px] bg-violet-600/15 rounded-full blur-[100px]" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-blue-900/30 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-28 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold px-4 py-1.5 rounded-full mb-8">
            <Zap className="h-3.5 w-3.5" />
            AI-Powered Project Management
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight max-w-4xl mx-auto">
            Deliver projects with{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-400">
              full confidence
            </span>
          </h1>

          <p className="mt-6 text-lg sm:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Gambaru brings clarity to complex portfolios — track progress, manage risks,
            and generate AI-powered executive reports. Built for modern PMOs.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={openDemo}
              className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-lg shadow-blue-900/40"
            >
              <ClipboardList className="h-4 w-4" />
              Đăng ký trải nghiệm
            </button>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
            >
              Sign In
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Capabilities bar */}
          <div className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/10 max-w-3xl mx-auto">
            {CAPABILITIES.map(({ icon: Icon, value, label, sub }) => (
              <div key={label} className="flex flex-col items-center gap-1 px-4 py-5 bg-white/5 hover:bg-white/10 transition-colors">
                <Icon className="h-5 w-5 text-blue-400 mb-1" />
                <span className="text-xl font-extrabold text-white">{value}</span>
                <span className="text-xs font-semibold text-slate-300">{label}</span>
                <span className="text-[10px] text-slate-500 text-center">{sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Dashboard Preview ────────────────────────────────────────────────── */}
      <section className="py-20 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-2">See it in action</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Your entire portfolio. One screen.</h2>
            <p className="mt-3 text-slate-500 text-sm max-w-xl mx-auto">A real-time health check across all projects — no spreadsheets, no manual reports.</p>
          </div>

          {/* Browser frame mockup */}
          <div className="rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            {/* Chrome bar */}
            <div className="bg-slate-100 px-4 py-2.5 flex items-center gap-3 border-b border-slate-200">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
              </div>
              <div className="flex-1 bg-white rounded-md px-3 py-1 text-xs text-slate-400 font-mono">gambaru.vn</div>
            </div>

            {/* App shell */}
            <div className="flex bg-slate-50" style={{ minHeight: '400px' }}>
              {/* Sidebar */}
              <div className="w-44 bg-[#0f172a] px-3 py-4 flex flex-col gap-1 shrink-0 hidden sm:flex">
                <div className="flex items-center gap-2 mb-4 px-2">
                  <div className="w-6 h-6 bg-orange-500/20 rounded-lg flex items-center justify-center shrink-0">
                    <KoinoboriIcon className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-white text-xs font-bold">Gambaru</span>
                </div>
                {['Portfolio', 'Roadmap', 'Reports', 'Programs', 'Projects'].map((item, i) => (
                  <div key={item} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${i === 0 ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{item}</div>
                ))}
              </div>

              {/* Main content */}
              <div className="flex-1 p-4 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] text-slate-400">Friday, 23 May 2025</p>
                    <p className="text-sm font-bold text-slate-800">Portfolio Health Check</p>
                  </div>
                  <div className="flex gap-2">
                    <div className="px-2.5 py-1 bg-white border border-slate-200 rounded text-[10px] text-slate-500">Portfolio Report</div>
                    <div className="px-2.5 py-1 bg-blue-600 rounded text-[10px] text-white font-semibold">+ New Project</div>
                  </div>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
                  {[
                    { label: 'Health Score', value: '85', sub: 'Excellent', color: 'text-green-600', bar: null },
                    { label: 'Projects at Risk', value: '3', sub: '2 RED · 1 AMBER', color: 'text-red-500', bar: null },
                    { label: 'Open Risks', value: '7', sub: '4 risks · 3 issues', color: 'text-orange-500', bar: null },
                    { label: 'Avg. Progress', value: '68%', sub: null, color: 'text-blue-600', bar: 68 },
                  ].map(k => (
                    <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-3">
                      <p className="text-[9px] text-slate-400 mb-1">{k.label}</p>
                      <p className={`text-lg font-extrabold ${k.color}`}>{k.value}</p>
                      {k.sub && <p className="text-[9px] text-slate-400 mt-0.5">{k.sub}</p>}
                      {k.bar !== null && (
                        <div className="mt-1.5 h-1 bg-slate-100 rounded-full"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${k.bar}%` }} /></div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Project list */}
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <div className="grid grid-cols-[56px_1fr_72px_90px] bg-slate-50 border-b px-3 py-2 text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                    <span>Status</span><span>Project</span><span>Phase</span><span>Progress</span>
                  </div>
                  {([
                    { rag: 'green', name: 'Digital Banking Portal', phase: 'Execution', pct: 82 },
                    { rag: 'amber', name: 'Core Insurance Platform', phase: 'Planning',  pct: 45 },
                    { rag: 'red',   name: 'Legacy System Migration', phase: 'Execution', pct: 28 },
                    { rag: 'green', name: 'Mobile App Relaunch',     phase: 'Closing',   pct: 91 },
                  ] as { rag: 'red'|'amber'|'green'; name: string; phase: string; pct: number }[]).map((p, i) => (
                    <div key={i} className="grid grid-cols-[56px_1fr_72px_90px] px-3 py-2 border-b last:border-0 items-center">
                      <span className={`flex items-center gap-1 text-[9px] font-bold ${p.rag === 'red' ? 'text-red-600' : p.rag === 'amber' ? 'text-amber-600' : 'text-green-600'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${p.rag === 'red' ? 'bg-red-500' : p.rag === 'amber' ? 'bg-amber-400' : 'bg-green-500'}`} />
                        {p.rag.toUpperCase()}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-700 truncate pr-2">{p.name}</span>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded w-fit ${
                        p.phase === 'Execution' ? 'bg-amber-100 text-amber-700' :
                        p.phase === 'Planning'  ? 'bg-blue-100 text-blue-700' :
                        p.phase === 'Closing'   ? 'bg-green-100 text-green-700' : 'bg-purple-100 text-purple-700'
                      }`}>{p.phase}</span>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full">
                          <div className={`h-full rounded-full ${p.pct >= 80 ? 'bg-green-500' : p.pct >= 40 ? 'bg-blue-500' : 'bg-red-400'}`} style={{ width: `${p.pct}%` }} />
                        </div>
                        <span className="text-[9px] text-slate-500 font-medium shrink-0">{p.pct}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-3">Features</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Everything your PMO needs
            </h2>
            <p className="mt-4 text-lg text-slate-500 max-w-xl mx-auto">
              From portfolio health to AI reports, Gambaru gives you a complete view of every project.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div
                key={f.title}
                className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-md hover:border-blue-200 transition-all group"
              >
                <div className={`w-11 h-11 ${f.bg} rounded-xl flex items-center justify-center mb-5`}>
                  <f.icon className={`h-5 w-5 ${f.color}`} />
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2 group-hover:text-blue-700 transition-colors">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 bg-[#0a0f1e] overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-20">
            <p className="text-sm font-bold text-blue-400 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              Up and running in minutes
            </h2>
            <p className="mt-3 text-slate-400 text-sm max-w-md mx-auto">Three steps from sign-up to your first AI-powered portfolio report.</p>
          </div>

          <div className="space-y-16">

            {/* ── Step 01 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="relative">
                <div className="absolute -top-6 -left-4 text-[120px] font-black text-blue-600/10 leading-none select-none pointer-events-none">01</div>
                <div className="relative">
                  <span className="inline-flex items-center gap-1.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold px-3 py-1 rounded-full mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400" /> Step 01
                  </span>
                  <h3 className="text-2xl font-extrabold text-white mb-3">Set up your portfolio</h3>
                  <p className="text-slate-400 leading-relaxed mb-5">Create your workspace in minutes. Add programs, projects, and invite your team. No complex config — the onboarding wizard walks you through everything.</p>
                  <div className="flex flex-col gap-2">
                    {['Create company workspace & invite team', 'Organise projects into programs', 'Import activities from Excel or start fresh'].map(t => (
                      <div key={t} className="flex items-center gap-2.5 text-sm text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />{t}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Illustration: Onboarding card */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
                    <KoinoboriIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-sm">Welcome to Gambaru</p>
                    <p className="text-slate-400 text-xs">Let&apos;s set up your workspace</p>
                  </div>
                  <div className="ml-auto text-[10px] text-slate-500">1 / 4</div>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1.5 font-medium">Company name</p>
                    <div className="bg-slate-700/60 border border-slate-600 rounded-lg px-3 py-2.5 text-sm text-white flex items-center justify-between">
                      <span>ACME Corporation</span>
                      <span className="w-2 h-4 bg-blue-400 rounded-sm animate-pulse" />
                    </div>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1.5 font-medium">First project name</p>
                    <div className="bg-slate-700/60 border border-blue-500/50 rounded-lg px-3 py-2.5 text-sm text-white">Digital Banking Portal</div>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-400 mb-1.5 font-medium">Current phase</p>
                    <div className="flex gap-1.5">
                      {(['Initiation', 'Planning', 'Execution', 'Closing'] as const).map((ph, i) => (
                        <span key={ph} className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-semibold ${i === 1 ? 'bg-blue-600 text-white' : 'bg-slate-700/60 text-slate-400'}`}>{ph}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-4 bg-blue-600 hover:bg-blue-500 transition-colors rounded-xl py-2.5 text-center text-sm font-bold text-white cursor-default">
                  Continue →
                </div>
              </div>
            </div>

            {/* Vertical connector */}
            <div className="flex justify-center">
              <div className="w-px h-8 bg-gradient-to-b from-slate-700 to-transparent" />
            </div>

            {/* ── Step 02 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              {/* Illustration first on desktop */}
              <div className="order-2 lg:order-1 bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-white font-bold text-sm">Digital Banking Portal</p>
                    <p className="text-slate-400 text-xs mt-0.5">Execution phase · 4 active tasks</p>
                  </div>
                  <span className="flex items-center gap-1 text-[10px] font-bold text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />GREEN
                  </span>
                </div>
                <div className="space-y-2 mb-4">
                  {[
                    { task: 'Requirements gathering', done: true,  pct: 100 },
                    { task: 'Architecture design',    done: true,  pct: 100 },
                    { task: 'Backend development',    done: false, pct: 75  },
                    { task: 'Integration testing',    done: false, pct: 20  },
                  ].map(t => (
                    <div key={t.task} className="flex items-center gap-3 bg-slate-700/40 rounded-lg px-3 py-2.5">
                      <div className={`w-4 h-4 rounded-md flex items-center justify-center shrink-0 ${t.done ? 'bg-green-500' : 'border border-slate-500 bg-slate-700'}`}>
                        {t.done && <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </div>
                      <span className={`text-xs flex-1 ${t.done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{t.task}</span>
                      <div className="w-14 h-1.5 bg-slate-600 rounded-full shrink-0">
                        <div className={`h-full rounded-full ${t.pct === 100 ? 'bg-green-500' : t.pct >= 50 ? 'bg-blue-500' : 'bg-amber-500'}`} style={{ width: `${t.pct}%` }} />
                      </div>
                      <span className="text-[10px] text-slate-400 w-6 text-right shrink-0">{t.pct}%</span>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-3 pt-3 border-t border-slate-700">
                  <span className="text-[11px] text-slate-400 shrink-0">Portfolio progress</span>
                  <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full" style={{ width: '68%' }} />
                  </div>
                  <span className="text-sm font-bold text-white shrink-0">68%</span>
                </div>
              </div>
              <div className="order-1 lg:order-2 relative">
                <div className="absolute -top-6 -right-4 text-[120px] font-black text-amber-500/10 leading-none select-none pointer-events-none text-right">02</div>
                <div className="relative">
                  <span className="inline-flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-400 text-xs font-bold px-3 py-1 rounded-full mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Step 02
                  </span>
                  <h3 className="text-2xl font-extrabold text-white mb-3">Track every project</h3>
                  <p className="text-slate-400 leading-relaxed mb-5">Log activities, update completion, manage risks and issues — all in one place. RAG health scoring updates in real time as your team makes progress.</p>
                  <div className="flex flex-col gap-2">
                    {['Live RAG status on every project', 'Activity timeline with % completion', 'Risk & issue register with escalation'].map(t => (
                      <div key={t} className="flex items-center gap-2.5 text-sm text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />{t}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Vertical connector */}
            <div className="flex justify-center">
              <div className="w-px h-8 bg-gradient-to-b from-slate-700 to-transparent" />
            </div>

            {/* ── Step 03 ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
              <div className="relative">
                <div className="absolute -top-6 -left-4 text-[120px] font-black text-violet-500/10 leading-none select-none pointer-events-none">03</div>
                <div className="relative">
                  <span className="inline-flex items-center gap-1.5 bg-violet-600/20 border border-violet-500/30 text-violet-400 text-xs font-bold px-3 py-1 rounded-full mb-4">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400" /> Step 03
                  </span>
                  <h3 className="text-2xl font-extrabold text-white mb-3">Report with confidence</h3>
                  <p className="text-slate-400 leading-relaxed mb-5">Generate board-ready executive summaries in seconds with Claude AI. Export to PDF, PowerPoint, or Word — formatted, structured, and ready to present.</p>
                  <div className="flex flex-col gap-2">
                    {['AI executive summary in one click', 'Export to PDF, PPT, or Word', 'Rotating weekly summary templates'].map(t => (
                      <div key={t} className="flex items-center gap-2.5 text-sm text-slate-300">
                        <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />{t}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Illustration: AI Report */}
              <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-6 shadow-xl">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 bg-violet-600/30 border border-violet-500/40 rounded-xl flex items-center justify-center shrink-0">
                    <Sparkles className="h-4 w-4 text-violet-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-white font-bold text-sm">AI Portfolio Report</p>
                    <p className="text-[10px] text-violet-400">Powered by Claude · Generated in 3s</p>
                  </div>
                  <div className="flex items-center gap-1 text-[10px] text-green-400 bg-green-400/10 px-2 py-1 rounded-full border border-green-400/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />Ready
                  </div>
                </div>
                <div className="bg-slate-700/40 rounded-xl p-4 mb-4">
                  <p className="text-xs text-slate-300 leading-relaxed mb-3">
                    &ldquo;Portfolio health is at <span className="text-green-400 font-semibold">85 / 100 — Excellent</span>. All 12 active projects are within acceptable parameters. Two projects require attention: <span className="text-amber-400 font-semibold">Core Insurance Platform</span> (planning delays) and <span className="text-red-400 font-semibold">Legacy Migration</span> (resource constraint).&rdquo;
                  </p>
                  <div className="space-y-1.5">
                    {[85, 60, 42].map((w, i) => (
                      <div key={i} className="h-1.5 bg-slate-600/60 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${i === 0 ? 'bg-violet-500' : i === 1 ? 'bg-violet-500/60' : 'bg-violet-500/30'}`} style={{ width: `${w}%` }} />
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  {(['PDF', 'PowerPoint', 'Word'] as const).map(fmt => (
                    <div key={fmt} className="flex-1 flex items-center justify-center gap-1.5 bg-slate-700/50 border border-slate-600/60 hover:border-slate-500 rounded-lg py-2 text-xs font-semibold text-slate-300 cursor-default transition-colors">
                      <Download className="h-3 w-3" />{fmt}
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── Why Gambaru ──────────────────────────────────────────────────────── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-3">Why Gambaru</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Built for teams that ship
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { icon: TrendingUp, text: 'Portfolio-level visibility with per-project drill-down' },
              { icon: Target, text: 'RAG status tracking — Red, Amber, Green at a glance' },
              { icon: FileBarChart2, text: 'AI executive summaries ready in seconds' },
              { icon: ShieldAlert, text: 'Integrated risk & issue register with escalation paths' },
              { icon: Calendar, text: 'Activity timeline with Excel import support' },
              { icon: Users, text: 'Resource capacity planning across domains and roles' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3 bg-white rounded-xl border border-slate-200 p-4">
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <span className="text-sm text-slate-700 font-medium">{text}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────────── */}
      <section className="py-24 bg-[#0f172a] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-600/15 rounded-full blur-[80px]" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[80px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <div className="inline-flex items-center justify-center mb-6 gap-2.5">
            <div className="bg-orange-500/15 rounded-xl p-3">
              <KoinoboriIcon className="h-8 w-8" />
            </div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mb-4">
            Ready to take control of your portfolio?
          </h2>
          <p className="text-slate-400 text-lg mb-10">
            Sign in to your Gambaru workspace and start managing projects with clarity.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-10 py-4 text-base font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-xl shadow-blue-900/40"
          >
            Sign In
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer className="bg-[#0a0f1e] border-t border-slate-800 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-orange-500/15 rounded-lg p-1.5">
              <KoinoboriIcon className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold text-slate-400">Gambaru</span>
          </div>
          <p className="text-xs text-slate-600">
            Project Management · AI-Powered · Built for PMOs
          </p>
          <div className="flex items-center gap-4">
            <button onClick={openDemo} className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors">
              Đăng ký trải nghiệm →
            </button>
            <Link href="/login" className="text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors">
              Sign In →
            </Link>
          </div>
        </div>
      </footer>

      {/* ── Demo Request Modal ───────────────────────────────────────────────── */}
      {demoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setDemoOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 sm:p-8">
            <button
              onClick={() => setDemoOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>

            {demoSuccess ? (
              <div className="text-center py-6">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="h-7 w-7 text-green-500" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Đã nhận yêu cầu!</h3>
                <p className="text-sm text-slate-500 mb-6">
                  Cảm ơn bạn đã đăng ký. Chúng tôi sẽ liên hệ với bạn trong thời gian sớm nhất.
                </p>
                <button
                  onClick={() => setDemoOpen(false)}
                  className="px-6 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
                >
                  Đóng
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center shrink-0">
                    <ClipboardList className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Đăng ký trải nghiệm</h3>
                    <p className="text-xs text-slate-500">Để lại thông tin, chúng tôi sẽ liên hệ với bạn</p>
                  </div>
                </div>

                <form onSubmit={submitDemo} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Họ và tên <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={demoForm.full_name}
                      onChange={e => setDemoForm(f => ({ ...f, full_name: e.target.value }))}
                      placeholder="Nguyễn Văn A"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Số điện thoại <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      required
                      value={demoForm.phone}
                      onChange={e => setDemoForm(f => ({ ...f, phone: e.target.value }))}
                      placeholder="0912 345 678"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      required
                      value={demoForm.email}
                      onChange={e => setDemoForm(f => ({ ...f, email: e.target.value }))}
                      placeholder="email@congty.com"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                      Tên công ty <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={demoForm.company_name}
                      onChange={e => setDemoForm(f => ({ ...f, company_name: e.target.value }))}
                      placeholder="Công ty TNHH ABC"
                      className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={demoLoading}
                    className="w-full py-3 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-xl transition-colors mt-2"
                  >
                    {demoLoading ? 'Đang gửi...' : 'Gửi đăng ký'}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
