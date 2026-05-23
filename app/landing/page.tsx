'use client';
import { useState } from 'react';
import Link from 'next/link';
import {
  BarChart3, ShieldAlert, FileBarChart2, Calendar, Users,
  DollarSign, ChevronRight, CheckCircle2, Menu, X,
  TrendingUp, Target, Zap, ArrowRight,
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

const STEPS = [
  {
    number: '01',
    title: 'Set up your portfolio',
    desc: 'Create programs, add projects, and invite your team. Onboarding takes minutes — no complex configuration required.',
  },
  {
    number: '02',
    title: 'Track every project',
    desc: 'Log activities, update status, manage risks and issues. Everything your PMO needs, in a single workspace.',
  },
  {
    number: '03',
    title: 'Report with confidence',
    desc: 'Generate AI-written executive summaries and portfolio reports. Export to PDF, PowerPoint, or Word on demand.',
  },
];

const STATS = [
  { value: '360°', label: 'Portfolio visibility' },
  { value: 'RAG', label: 'Health scoring' },
  { value: 'AI', label: 'Powered reports' },
  { value: '1-click', label: 'PDF / PPT export' },
];

export default function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

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
            <Link href="/login" className="mt-2 text-center py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg">
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
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-lg shadow-blue-900/40"
            >
              Sign In to your workspace
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center gap-2 px-8 py-3.5 text-sm font-semibold text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-xl transition-colors"
            >
              Explore features
              <ChevronRight className="h-4 w-4" />
            </a>
          </div>

          {/* Stats strip */}
          <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-6 max-w-2xl mx-auto">
            {STATS.map(s => (
              <div key={s.label} className="flex flex-col items-center gap-1">
                <span className="text-2xl font-extrabold text-white">{s.value}</span>
                <span className="text-xs text-slate-500">{s.label}</span>
              </div>
            ))}
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
      <section id="how-it-works" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-bold text-blue-600 uppercase tracking-widest mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Up and running in minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-8 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />

            {STEPS.map((step, i) => (
              <div key={step.number} className="relative flex flex-col items-center text-center px-4">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-extrabold mb-5 shadow-sm ${
                  i === 0 ? 'bg-blue-600 text-white' :
                  i === 1 ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                            'bg-slate-50 text-slate-700 border border-slate-200'
                }`}>
                  {step.number}
                </div>
                <h3 className="text-base font-bold text-slate-900 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
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
          <Link href="/login" className="text-xs font-semibold text-blue-500 hover:text-blue-400 transition-colors">
            Sign In →
          </Link>
        </div>
      </footer>

    </div>
  );
}
