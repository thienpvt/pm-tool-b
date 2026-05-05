'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, FolderKanban, Calendar, Users,
  MessageSquare, AlertTriangle, FileText, BarChart3, TrendingDown,
  PieChart, Building2, ClipboardList, FileBarChart2, LogOut, ShieldCheck, ChevronDown,
} from 'lucide-react';

const NAV = [
  { href: '/', icon: LayoutDashboard, label: 'Portfolio' },
  { href: '/portfolio/report', icon: FileBarChart2, label: 'Portfolio Report' },
  { href: '/customers', icon: Building2, label: 'Customers' },
];

const PROJECT_NAV = [
  { href: '/dashboard', icon: PieChart, label: 'Project Dashboard' },
  { href: '/timeline', icon: Calendar, label: 'Project Timeline' },
  { href: '/resources', icon: Users, label: 'Resource Plan' },
  { href: '/communication', icon: MessageSquare, label: 'Communication' },
  { href: '/risks', icon: AlertTriangle, label: 'Risks & Issues' },
  { href: '/analysis', icon: TrendingDown, label: 'Delay Analysis' },
  { href: '/reports', icon: ClipboardList, label: 'Weekly Report' },
  { href: '/documents', icon: FileText, label: 'Documents' },
];

type Me = { username: string; display_name: string; company_name: string | null; is_admin: number };

export default function Sidebar({ projectId }: { projectId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => { if (data) setMe(data); });
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  return (
    <aside className="w-60 min-h-screen bg-[#0f172a] text-slate-200 flex flex-col shrink-0">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-6 w-6 text-blue-400 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white leading-tight truncate">
              {me?.company_name ?? 'PM Tool'}
            </p>
            <p className="text-xs text-slate-400 leading-tight">Project Manager</p>
          </div>
        </div>
      </div>

      {/* Main nav */}
      <nav className="p-3 flex flex-col gap-1">
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname === href
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-700 hover:text-white'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}

        {/* Admin link — only for admins */}
        {me?.is_admin ? (
          <Link
            href="/admin"
            className={cn(
              'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
              pathname === '/admin'
                ? 'bg-amber-600 text-white'
                : 'text-amber-400 hover:bg-slate-700 hover:text-amber-300'
            )}
          >
            <ShieldCheck className="h-4 w-4 shrink-0" />
            Admin Panel
          </Link>
        ) : null}
      </nav>

      {/* Project-specific nav */}
      {projectId && (
        <div className="mt-2 px-3">
          <p className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-2">Project</p>
          <div className="flex flex-col gap-1">
            {PROJECT_NAV.map(({ href, icon: Icon, label }) => {
              const full = `/projects/${projectId}${href}`;
              return (
                <Link
                  key={href}
                  href={full}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                    pathname === full
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* User section */}
      <div className="mt-auto border-t border-slate-700/60">
        <button
          onClick={() => setUserMenuOpen(v => !v)}
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-800 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(me?.display_name || me?.username || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{me?.display_name || me?.username || '…'}</p>
            <p className="text-[10px] text-slate-500 truncate">{me?.username}</p>
          </div>
          <ChevronDown className={cn('h-3.5 w-3.5 text-slate-500 shrink-0 transition-transform', userMenuOpen && 'rotate-180')} />
        </button>

        {userMenuOpen && (
          <div className="px-3 pb-3">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
