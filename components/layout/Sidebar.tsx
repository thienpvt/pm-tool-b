'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Calendar, Users,
  MessageSquare, AlertTriangle, FileText, TrendingDown,
  PieChart, Building2, ClipboardList, FileBarChart2,
  LogOut, ShieldCheck, ChevronDown, KeyRound, Menu, X,
  FolderOpen, Plus, Map, DollarSign, UserCog, Flag, Bug, BarChart2,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

function KoinoboriIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M7 14 C7 7 20 6 22 12 L22 16 C20 22 7 21 7 14Z" fill="#fb923c"/>
      <circle cx="7" cy="14" r="3.5" fill="none" stroke="#fb923c" strokeWidth="2"/>
      <path d="M12 10 A3 3 0 0 1 17 10" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" fill="none"/>
      <path d="M10 14 A3 3 0 0 1 15 14" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" fill="none"/>
      <path d="M15 14 A3 3 0 0 1 20 14" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" fill="none"/>
      <path d="M12 18 A3 3 0 0 1 17 18" stroke="rgba(255,255,255,0.6)" strokeWidth="1.3" fill="none"/>
      <path d="M22 12 L28 7 L25 14 L28 21 L22 16Z" fill="#fb923c"/>
      <circle cx="10" cy="11" r="2" fill="white"/>
      <circle cx="10.5" cy="11.5" r="1" fill="#1e293b"/>
    </svg>
  );
}

const NAV = [
  { href: '/', icon: LayoutDashboard, label: 'Portfolio' },
  { href: '/portfolio/roadmap', icon: Map, label: 'Portfolio Roadmap' },
  { href: '/portfolio/report', icon: FileBarChart2, label: 'Portfolio Report' },
  { href: '/portfolio/budget', icon: DollarSign, label: 'Portfolio Budget' },
  { href: '/resources', icon: UserCog, label: 'Resource Management' },
  { href: '/operations', icon: ShieldCheck, label: 'Operations' },
  { href: '/programs', icon: Building2, label: 'Programs' },
];

const PROJECT_NAV = [
  { href: '/dashboard', icon: PieChart, label: 'Project Dashboard' },
  { href: '/timeline', icon: Calendar, label: 'Project Timeline' },
  { href: '/milestones', icon: Flag, label: 'Milestones' },
  { href: '/resources', icon: Users, label: 'Resource Plan' },
  { href: '/communication', icon: MessageSquare, label: 'Communication' },
  { href: '/budget', icon: DollarSign, label: 'Budget & Cost' },
  { href: '/risks', icon: AlertTriangle, label: 'Risks & Issues' },
  { href: '/bugs', icon: Bug, label: 'Bug Tracking' },
  { href: '/analysis', icon: TrendingDown, label: 'Delay Analysis' },
  { href: '/reports', icon: ClipboardList, label: 'Weekly Report' },
  { href: '/documents', icon: FileText, label: 'Documents' },
  { href: '/report', icon: BarChart2, label: 'Project Report' },
];

type Me = { username: string; display_name: string; company_name: string | null; is_admin: number };
type ProjectItem = { id: number; name: string; current_phase: string };

const PHASE_DOT: Record<string, string> = {
  Initiation: 'bg-purple-400',
  Planning:   'bg-blue-400',
  Execution:  'bg-amber-400',
  Closing:    'bg-green-400',
};

// ─── Shared nav content (used in both desktop sidebar and mobile drawer) ───────
function SidebarNav({
  me, pathname, projectId, projects, projectsOpen, onToggleProjects,
  userMenuOpen, onToggleUserMenu, onChangePwd, onLogout,
  onNavClick, onClose,
}: {
  me: Me | null;
  pathname: string;
  projectId?: string;
  projects: ProjectItem[];
  projectsOpen: boolean;
  onToggleProjects: () => void;
  userMenuOpen: boolean;
  onToggleUserMenu: () => void;
  onChangePwd: () => void;
  onLogout: () => void;
  onNavClick?: () => void;
  onClose?: () => void;
}) {
  return (
    <>
      {/* Logo + user section */}
      <div className="px-5 py-4 border-b border-slate-700/60">
        <div className="flex items-center gap-2 mb-3">
          <KoinoboriIcon className="h-6 w-6 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-white leading-tight truncate">
              {me?.company_name ?? 'PM Tool'}
            </p>
            <p className="text-xs text-slate-400 leading-tight">Project Manager</p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-slate-800 transition-colors shrink-0"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4 text-slate-400" />
            </button>
          )}
        </div>

        <button
          onClick={onToggleUserMenu}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-slate-800 transition-colors text-left"
        >
          <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(me?.display_name || me?.username || '?')[0].toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">{me?.display_name || me?.username || '…'}</p>
            <p className="text-[10px] text-slate-500 truncate">{me?.username}</p>
          </div>
          <ChevronDown className={cn('h-3.5 w-3.5 text-slate-500 shrink-0 transition-transform', userMenuOpen && 'rotate-180')} />
        </button>

        {userMenuOpen && (
          <div className="mt-1 flex flex-col gap-0.5">
            <button
              onClick={onChangePwd}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
            >
              <KeyRound className="h-3.5 w-3.5" />
              Change Password
            </button>
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign Out
            </button>
          </div>
        )}
      </div>

      {/* Main nav */}
      <nav className="p-3 flex flex-col gap-1">
        {NAV.map(({ href, icon: Icon, label }) => (
          <Link
            key={href}
            href={href}
            onClick={onNavClick}
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

        {/* Projects collapsible */}
        <button
          onClick={onToggleProjects}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
        >
          <FolderOpen className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Projects</span>
          {projects.length > 0 && (
            <span className="text-[10px] bg-slate-700 text-slate-400 rounded px-1.5 py-0.5 font-medium">
              {projects.length}
            </span>
          )}
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 transition-transform', projectsOpen && 'rotate-180')} />
        </button>

        {projectsOpen && (
          <div className="ml-3 flex flex-col gap-0.5 border-l border-slate-700/60 pl-3">
            {projects.length === 0 && (
              <p className="px-2 py-1.5 text-xs text-slate-500 italic">No projects yet</p>
            )}
            {projects.slice(0, 5).map(p => {
              const isActive = projectId === String(p.id);
              const dot = PHASE_DOT[p.current_phase] ?? 'bg-slate-500';
              return (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  onClick={onNavClick}
                  title={p.name}
                  className={cn(
                    'flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors',
                    isActive
                      ? 'bg-blue-600/20 text-blue-300 font-medium'
                      : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                  )}
                >
                  <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', dot)} />
                  <span className="truncate">{p.name}</span>
                </Link>
              );
            })}
            {projects.length > 5 && (
              <Link
                href="/projects"
                onClick={onNavClick}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-blue-400 hover:bg-slate-700 hover:text-blue-300 transition-colors"
              >
                <FolderOpen className="h-3 w-3 shrink-0" />
                See all projects ({projects.length})
              </Link>
            )}
            <Link
              href="/projects/new"
              onClick={onNavClick}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-slate-500 hover:bg-slate-700 hover:text-white transition-colors mt-0.5"
            >
              <Plus className="h-3 w-3 shrink-0" />
              New project
            </Link>
          </div>
        )}

        {me?.is_admin ? (
          <Link
            href="/admin"
            onClick={onNavClick}
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
        <div className="mt-2 px-3 pb-4">
          <p className="text-xs text-slate-500 uppercase tracking-widest px-3 mb-2">Project</p>
          <div className="flex flex-col gap-1">
            {PROJECT_NAV.map(({ href, icon: Icon, label }) => {
              const full = `/projects/${projectId}${href}`;
              return (
                <Link
                  key={href}
                  href={full}
                  onClick={onNavClick}
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
    </>
  );
}

// ─── Main Sidebar component ────────────────────────────────────────────────────
export default function Sidebar({ projectId }: { projectId?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [pwdLoading, setPwdLoading] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.ok ? r.json() : null).then(data => { if (data) setMe(data); });
    fetch('/api/projects').then(r => r.ok ? r.json() : []).then((data: ProjectItem[]) => setProjects(data ?? []));
  }, []);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  };

  const openChangePwd = () => {
    setPwdForm({ current: '', next: '', confirm: '' });
    setUserMenuOpen(false);
    setMobileOpen(false);
    setChangePwdOpen(true);
  };

  const handleChangePwd = async () => {
    if (!pwdForm.current || !pwdForm.next || !pwdForm.confirm) { toast.error('All fields are required'); return; }
    if (pwdForm.next !== pwdForm.confirm) { toast.error('New passwords do not match'); return; }
    if (pwdForm.next.length < 6) { toast.error('New password must be at least 6 characters'); return; }
    setPwdLoading(true);
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: pwdForm.current, new_password: pwdForm.next }),
    });
    setPwdLoading(false);
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('Password changed successfully');
    setChangePwdOpen(false);
  };

  const navProps = {
    me, pathname, projectId, projects, projectsOpen,
    onToggleProjects: () => setProjectsOpen(v => !v),
    userMenuOpen,
    onToggleUserMenu: () => setUserMenuOpen(v => !v),
    onChangePwd: openChangePwd,
    onLogout: handleLogout,
  };

  return (
    <>
      {/* ── Mobile top bar (visible on < lg) ── */}
      <div className="lg:hidden h-14 bg-[#0f172a] text-slate-200 flex items-center px-4 gap-3 border-b border-slate-700/60 w-full shrink-0">
        <KoinoboriIcon className="h-6 w-6 shrink-0" />
        <p className="text-sm font-bold text-white truncate flex-1">{me?.company_name ?? 'PM Tool'}</p>
        <button
          onClick={() => setMobileOpen(true)}
          className="p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5 text-slate-300" />
        </button>
      </div>

      {/* ── Desktop sidebar (visible on lg+) ── */}
      <aside className="hidden lg:flex w-60 min-h-screen bg-[#0f172a] text-slate-200 flex-col shrink-0">
        <SidebarNav {...navProps} />
      </aside>

      {/* ── Mobile drawer ── */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="p-0 bg-[#0f172a] text-slate-200 border-r border-slate-700/60 overflow-y-auto"
          showCloseButton={false}
        >
          <SidebarNav
            {...navProps}
            onNavClick={() => setMobileOpen(false)}
            onClose={() => setMobileOpen(false)}
          />
        </SheetContent>
      </Sheet>

      {/* ── Change Password Dialog ── */}
      <Dialog open={changePwdOpen} onOpenChange={setChangePwdOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-blue-500" />
              Change Password
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Current Password</Label>
              <Input className="mt-1.5" type="password" value={pwdForm.current}
                onChange={e => setPwdForm(f => ({ ...f, current: e.target.value }))}
                placeholder="Your current password" autoFocus />
            </div>
            <div>
              <Label>New Password</Label>
              <Input className="mt-1.5" type="password" value={pwdForm.next}
                onChange={e => setPwdForm(f => ({ ...f, next: e.target.value }))}
                placeholder="Min. 6 characters" />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input className="mt-1.5" type="password" value={pwdForm.confirm}
                onChange={e => setPwdForm(f => ({ ...f, confirm: e.target.value }))}
                placeholder="Repeat new password"
                onKeyDown={e => e.key === 'Enter' && handleChangePwd()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setChangePwdOpen(false)}>Cancel</Button>
            <Button onClick={handleChangePwd} disabled={pwdLoading} className="bg-blue-600 hover:bg-blue-700">
              {pwdLoading ? 'Saving…' : 'Change Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
