'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, KeyRound, Building2, Users, ShieldCheck, ClipboardList, CheckCircle2, Clock, XCircle, Phone, Mail, MessageSquare, Link2, CheckCircle, Loader2, Gauge, Lock, Unlock, Search } from 'lucide-react';
import type { AppRole, UserStatus } from '@/lib/services/access';

type Company = { id: number; name: string; user_count: number };
type User = {
  id: number;
  username: string;
  display_name: string;
  email: string;
  company_id: number;
  company_name?: string | null;
  roles: AppRole[];
  status: UserStatus;
};
type Me = { id: number; username: string; is_admin: number; roles?: AppRole[] };
type DemoRequest = { id: number; full_name: string; phone: string; email: string; company_name: string; status: string; notes: string; created_at: string };

type UserForm = {
  username: string;
  display_name: string;
  email: string;
  roles: AppRole[];
  status: UserStatus;
  password: string;
};

const EMPTY_USER: UserForm = {
  username: '',
  display_name: '',
  email: '',
  roles: ['pm'],
  status: 'active',
  password: '',
};

const ALL_ROLES: AppRole[] = ['cpmo', 'pm', 'viewer'];
const ROLE_LABELS: Record<AppRole, string> = { cpmo: 'CPMO', pm: 'PM', viewer: 'Viewer' };
const USER_STATUS_STYLE: Record<UserStatus, string> = {
  active: 'bg-green-50 text-green-700',
  inactive: 'bg-slate-100 text-slate-500',
  locked: 'bg-red-50 text-red-700',
};

function canAccessAdmin(me: Me): boolean {
  return !!me.is_admin || (me.roles?.includes('cpmo') ?? false);
}

function canMutateUsers(me: Me): boolean {
  if (me.is_admin) return true;
  return me.roles?.includes('cpmo') ?? false;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: 'Pending',   color: 'bg-amber-50 text-amber-700 border-amber-200',  icon: <Clock className="h-3 w-3" /> },
  contacted: { label: 'Contacted', color: 'bg-blue-50 text-blue-700 border-blue-200',     icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected:  { label: 'Rejected',  color: 'bg-slate-100 text-slate-500 border-slate-200', icon: <XCircle className="h-3 w-3" /> },
};

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState<'users' | 'companies' | 'requests'>('users');
  const [demoRequests, setDemoRequests] = useState<DemoRequest[]>([]);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteRequest, setNoteRequest] = useState<DemoRequest | null>(null);
  const [noteText, setNoteText] = useState('');

  // Company dialog
  const [companyOpen, setCompanyOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState('');

  // User dialog
  const [userOpen, setUserOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState(EMPTY_USER);

  // Reset password dialog
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [resetPwd, setResetPwd] = useState('');
  const [resetConfirm, setResetConfirm] = useState('');

  // Jira config dialog
  const [jiraOpen, setJiraOpen] = useState(false);
  const [jiraCompany, setJiraCompany] = useState<Company | null>(null);
  const [jiraForm, setJiraForm] = useState({ base_url_var: '', email_var: '', token_var: '' });
  const [jiraTesting, setJiraTesting] = useState(false);
  const [jiraTestResult, setJiraTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // RAG config dialog
  const DEFAULT_RAG = { spi_red_threshold: 0.6, spi_amber_threshold: 0.8, deadline_red_days: 0, deadline_amber_days: 14, risks_red: 3, risks_amber: 1, issues_amber: 1, low_progress_amber: 30 };
  type RagForm = typeof DEFAULT_RAG;
  const [ragOpen, setRagOpen] = useState(false);
  const [ragCompany, setRagCompany] = useState<Company | null>(null);
  const [ragForm, setRagForm] = useState<RagForm>(DEFAULT_RAG);

  const [searchQ, setSearchQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | AppRole>('all');

  const loadCompanies = useCallback(() =>
    fetch('/api/admin/companies').then(r => r.json()).then(setCompanies), []);
  const loadUsers = useCallback(() => {
    const params = new URLSearchParams();
    if (searchQ.trim()) params.set('q', searchQ.trim());
    if (statusFilter !== 'all') params.set('status', statusFilter);
    if (roleFilter !== 'all') params.set('role', roleFilter);
    const qs = params.toString();
    return fetch(`/api/admin/users${qs ? `?${qs}` : ''}`).then(r => r.json()).then(setUsers);
  }, [searchQ, statusFilter, roleFilter]);
  const loadDemoRequests = useCallback(() =>
    fetch('/api/admin/demo-requests').then(r => r.json()).then(setDemoRequests), []);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then((data: Me) => {
      if (!data || !canAccessAdmin(data)) { router.replace('/'); return; }
      setMe(data);
      if (data.is_admin) {
        loadCompanies();
        loadDemoRequests();
      }
    });
  }, [router, loadCompanies, loadDemoRequests]);

  useEffect(() => {
    if (me) loadUsers();
  }, [me, loadUsers]);

  // ── Companies ──────────────────────────────────────────────────────────────
  const openAddCompany = () => { setEditCompany(null); setCompanyName(''); setCompanyOpen(true); };
  const openEditCompany = (c: Company) => { setEditCompany(c); setCompanyName(c.name); setCompanyOpen(true); };

  const saveCompany = async () => {
    if (!companyName.trim()) return;
    const method = editCompany ? 'PUT' : 'POST';
    const body = editCompany ? { id: editCompany.id, name: companyName } : { name: companyName };
    const res = await fetch('/api/admin/companies', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success(editCompany ? 'Company updated' : 'Company created');
    setCompanyOpen(false);
    loadCompanies();
    loadUsers();
  };

  const deleteCompany = async (c: Company) => {
    if (c.user_count > 0) { toast.error(`Cannot delete: ${c.user_count} user(s) assigned`); return; }
    if (!confirm(`Delete company "${c.name}"?`)) return;
    await fetch(`/api/admin/companies?id=${c.id}`, { method: 'DELETE' });
    toast.success('Company deleted');
    loadCompanies();
  };

  // ── Jira Config ────────────────────────────────────────────────────────────
  const openJiraConfig = async (c: Company) => {
    setJiraCompany(c);
    setJiraTestResult(null);
    const res = await fetch(`/api/admin/jira-config/${c.id}`);
    const data = await res.json();
    setJiraForm({ base_url_var: data.base_url_var || '', email_var: data.email_var || '', token_var: data.token_var || '' });
    setJiraOpen(true);
  };

  const saveJiraConfig = async () => {
    if (!jiraCompany) return;
    const res = await fetch(`/api/admin/jira-config/${jiraCompany.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jiraForm),
    });
    if (!res.ok) { toast.error('Lưu thất bại'); return; }
    toast.success(`Đã lưu cấu hình Jira cho ${jiraCompany.name}`);
    setJiraOpen(false);
  };

  const testJiraConfig = async () => {
    setJiraTesting(true);
    setJiraTestResult(null);
    try {
      const res = await fetch('/api/jira/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyId: jiraCompany?.id, ...jiraForm }),
      });
      const data = await res.json();
      if (data.ok) {
        setJiraTestResult({ ok: true, message: `Kết nối thành công — ${data.displayName} (${data.email})` });
      } else {
        setJiraTestResult({ ok: false, message: data.error ?? 'Lỗi không xác định' });
      }
    } catch {
      setJiraTestResult({ ok: false, message: 'Không kết nối được tới server' });
    } finally {
      setJiraTesting(false);
    }
  };

  // ── RAG Config ─────────────────────────────────────────────────────────────
  const openRagConfig = async (c: Company) => {
    setRagCompany(c);
    const res = await fetch(`/api/admin/rag-config/${c.id}`);
    const data = await res.json();
    setRagForm({ ...DEFAULT_RAG, ...data });
    setRagOpen(true);
  };

  const saveRagConfig = async () => {
    if (!ragCompany) return;
    const res = await fetch(`/api/admin/rag-config/${ragCompany.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ragForm),
    });
    if (!res.ok) { toast.error('Lưu thất bại'); return; }
    toast.success(`Đã lưu cấu hình RAG cho ${ragCompany.name}`);
    setRagOpen(false);
  };

  // ── Users ──────────────────────────────────────────────────────────────────
  const openAddUser = () => { setEditUser(null); setUserForm(EMPTY_USER); setUserOpen(true); };
  const openEditUser = (u: User) => {
    setEditUser(u);
    setUserForm({
      username: u.username,
      display_name: u.display_name,
      email: u.email,
      roles: [...u.roles],
      status: u.status,
      password: '',
    });
    setUserOpen(true);
  };

  const toggleRole = (role: AppRole) => {
    setUserForm(f => {
      const has = f.roles.includes(role);
      const next = has ? f.roles.filter(r => r !== role) : [...f.roles, role];
      return { ...f, roles: next.length ? next : f.roles };
    });
  };

  const saveUser = async () => {
    if (!editUser && (!userForm.username.trim() || !userForm.password)) {
      toast.error('Username and password required'); return;
    }
    if (!userForm.email.trim()) {
      toast.error('Email required'); return;
    }
    if (!userForm.roles.length) {
      toast.error('At least one role required'); return;
    }
    if (userForm.password && userForm.password.length < 8) {
      toast.error('Password must be at least 8 characters'); return;
    }
    const body = editUser
      ? {
          id: editUser.id,
          display_name: userForm.display_name,
          email: userForm.email.trim(),
          roles: userForm.roles,
          status: userForm.status,
          ...(userForm.password ? { password: userForm.password } : {}),
        }
      : {
          username: userForm.username.trim(),
          display_name: userForm.display_name,
          email: userForm.email.trim(),
          roles: userForm.roles,
          status: userForm.status,
          password: userForm.password,
        };
    const res = await fetch('/api/admin/users', {
      method: editUser ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success(editUser ? 'User updated' : 'User created');
    setUserOpen(false);
    loadUsers();
  };

  const openResetPwd = (u: User) => { setResetUser(u); setResetPwd(''); setResetConfirm(''); setResetOpen(true); };
  const doResetPwd = async () => {
    if (!resetPwd) { toast.error('Enter a new password'); return; }
    if (resetPwd !== resetConfirm) { toast.error('Passwords do not match'); return; }
    if (resetPwd.length < 8) { toast.error('Password must be at least 8 characters'); return; }
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: resetUser!.id, password: resetPwd }),
    });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success(`Password reset for ${resetUser!.username}`);
    setResetOpen(false);
  };

  const deleteUser = async (u: User) => {
    if (u.id === me?.id) { toast.error('Cannot deactivate yourself'); return; }
    if (!confirm(`Deactivate user "${u.username}"?`)) return;
    const res = await fetch(`/api/admin/users?id=${u.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('User deactivated');
    loadUsers();
  };

  const toggleLock = async (u: User) => {
    const newStatus: UserStatus = u.status === 'locked' ? 'active' : 'locked';
    const res = await fetch('/api/admin/users', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, status: newStatus }),
    });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success(newStatus === 'locked' ? 'User locked' : 'User unlocked');
    loadUsers();
  };

  // ── Demo Requests ──────────────────────────────────────────────────────────
  const updateRequestStatus = async (req: DemoRequest, status: string) => {
    const res = await fetch('/api/admin/demo-requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: req.id, status }),
    });
    if (!res.ok) { toast.error('Failed to update status'); return; }
    toast.success('Status updated');
    loadDemoRequests();
  };

  const openNote = (req: DemoRequest) => { setNoteRequest(req); setNoteText(req.notes || ''); setNoteOpen(true); };

  const saveNote = async () => {
    if (!noteRequest) return;
    const res = await fetch('/api/admin/demo-requests', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: noteRequest.id, notes: noteText }),
    });
    if (!res.ok) { toast.error('Failed to save note'); return; }
    toast.success('Note saved');
    setNoteOpen(false);
    loadDemoRequests();
  };

  const deleteRequest = async (req: DemoRequest) => {
    if (!confirm(`Delete request from "${req.full_name}"?`)) return;
    await fetch(`/api/admin/demo-requests?id=${req.id}`, { method: 'DELETE' });
    toast.success('Deleted');
    loadDemoRequests();
  };

  if (!me) return null;

  const isPlatformAdmin = !!me.is_admin;
  const showMutate = canMutateUsers(me);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-blue-100 rounded-xl p-2.5">
            <ShieldCheck className="h-6 w-6 text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">Admin Panel</h1>
            <p className="text-sm text-slate-500">{isPlatformAdmin ? 'Manage users and companies' : 'Manage company users'}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-slate-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab('users')}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'users' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Users className="h-3.5 w-3.5" />
            Users ({users.length})
          </button>
          {isPlatformAdmin && (
            <>
              <button
                onClick={() => setTab('companies')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'companies' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <Building2 className="h-3.5 w-3.5" />
                Companies ({companies.length})
              </button>
              <button
                onClick={() => setTab('requests')}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${tab === 'requests' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                Demo Requests
                {demoRequests.filter(r => r.status === 'pending').length > 0 && (
                  <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {demoRequests.filter(r => r.status === 'pending').length}
                  </span>
                )}
              </button>
            </>
          )}
        </div>

        {/* ── Users tab ───────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b">
              <h2 className="font-semibold text-slate-700">Company Users</h2>
              {showMutate && (
                <Button onClick={openAddUser} className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-3.5 w-3.5" /> Add User
                </Button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 px-5 py-3 border-b bg-slate-50/50">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  className="h-8 pl-8 text-xs"
                  placeholder="Search username, email, name…"
                  value={searchQ}
                  onChange={e => setSearchQ(e.target.value)}
                />
              </div>
              <select
                className="h-8 text-xs border rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as 'all' | UserStatus)}
              >
                <option value="all">All statuses</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="locked">Locked</option>
              </select>
              <select
                className="h-8 text-xs border rounded-md px-2 focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value as 'all' | AppRole)}
              >
                <option value="all">All roles</option>
                <option value="cpmo">CPMO</option>
                <option value="pm">PM</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Username</th>
                  <th className="px-5 py-3">Display Name</th>
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Roles</th>
                  <th className="px-5 py-3">Status</th>
                  {showMutate && <th className="px-5 py-3 w-32">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono font-medium text-slate-800">{u.username}</td>
                    <td className="px-5 py-3 text-slate-600">{u.display_name || '—'}</td>
                    <td className="px-5 py-3 text-slate-600 text-xs">{u.email || '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {u.roles.map(r => (
                          <span key={r} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                            {ROLE_LABELS[r]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${USER_STATUS_STYLE[u.status]}`}>
                        {u.status}
                      </span>
                    </td>
                    {showMutate && (
                      <td className="px-5 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => openEditUser(u)} className="text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => openResetPwd(u)} className="text-slate-400 hover:text-amber-600 transition-colors" title="Reset password">
                            <KeyRound className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => toggleLock(u)}
                            className="text-slate-400 hover:text-orange-600 transition-colors"
                            title={u.status === 'locked' ? 'Unlock' : 'Lock'}
                          >
                            {u.status === 'locked' ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                          </button>
                          <button onClick={() => deleteUser(u)} className="text-slate-400 hover:text-red-500 transition-colors" title="Deactivate" disabled={u.id === me?.id}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={showMutate ? 6 : 5} className="px-5 py-10 text-center text-slate-400">No users found</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* ── Companies tab ────────────────────────────────────────────────── */}
        {tab === 'companies' && isPlatformAdmin && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold text-slate-700">All Companies</h2>
              <Button onClick={openAddCompany} className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-3.5 w-3.5" /> Add Company
              </Button>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Company Name</th>
                  <th className="px-5 py-3">Users</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3 w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {companies.map(c => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-medium text-slate-800">{c.name}</td>
                    <td className="px-5 py-3 text-slate-600">{c.user_count}</td>
                    <td className="px-5 py-3 text-slate-400 text-xs">{c.id}</td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEditCompany(c)} className="text-slate-400 hover:text-blue-600 transition-colors" title="Edit company">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => openJiraConfig(c)} className="text-slate-400 hover:text-violet-600 transition-colors" title="Cấu hình Jira">
                          <Link2 className="h-4 w-4" />
                        </button>
                        <button onClick={() => openRagConfig(c)} className="text-slate-400 hover:text-emerald-600 transition-colors" title="Cấu hình RAG">
                          <Gauge className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteCompany(c)} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {companies.length === 0 && (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-400">No companies yet</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}
        {/* ── Requests tab ─────────────────────────────────────────────────── */}
        {tab === 'requests' && isPlatformAdmin && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold text-slate-700">Demo Requests</h2>
              <span className="text-xs text-slate-400">{demoRequests.length} requests</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-5 py-3">Full Name</th>
                    <th className="px-5 py-3">Company</th>
                    <th className="px-5 py-3">Contact</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Submitted</th>
                    <th className="px-5 py-3 w-36">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {demoRequests.map(r => {
                    const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.pending;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-medium text-slate-800">{r.full_name}</td>
                        <td className="px-5 py-3 text-slate-600">{r.company_name}</td>
                        <td className="px-5 py-3">
                          <div className="flex flex-col gap-0.5 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{r.phone}</span>
                            <span className="flex items-center gap-1"><Mail className="h-3 w-3 shrink-0" />{r.email}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <select
                            value={r.status}
                            onChange={e => updateRequestStatus(r, e.target.value)}
                            className={`text-xs font-semibold border rounded-full px-2.5 py-1 focus:outline-none cursor-pointer ${cfg.color}`}
                          >
                            <option value="pending">Pending</option>
                            <option value="contacted">Contacted</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-400">
                          {new Date(r.created_at).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2 items-center">
                            <button
                              onClick={() => openNote(r)}
                              className="text-slate-400 hover:text-blue-600 transition-colors"
                              title={r.notes ? `Note: ${r.notes}` : 'Add note'}
                            >
                              <MessageSquare className={`h-4 w-4 ${r.notes ? 'text-blue-400' : ''}`} />
                            </button>
                            <button onClick={() => deleteRequest(r)} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {demoRequests.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">No requests yet</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ── Note Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              Notes — {noteRequest?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Note</Label>
            <textarea
              className="mt-1.5 w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-[80px] resize-none"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Add a note about this request..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Cancel</Button>
            <Button onClick={saveNote} className="bg-blue-600 hover:bg-blue-700">Save note</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Company Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={companyOpen} onOpenChange={setCompanyOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editCompany ? 'Edit Company' : 'Add Company'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Company Name</Label>
              <Input className="mt-1.5" value={companyName} onChange={e => setCompanyName(e.target.value)}
                placeholder="e.g. Acme Corp" autoFocus
                onKeyDown={e => e.key === 'Enter' && saveCompany()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCompanyOpen(false)}>Cancel</Button>
            <Button onClick={saveCompany} className="bg-blue-600 hover:bg-blue-700" disabled={!companyName.trim()}>
              {editCompany ? 'Save' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Jira Config Dialog ─────────────────────────────────────────────── */}
      <Dialog open={jiraOpen} onOpenChange={setJiraOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-violet-600" />
              Cấu hình Jira — {jiraCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 leading-relaxed">
              Nhập <strong>tên biến môi trường</strong> đã set trên server cho công ty này.
              Ví dụ: nếu bạn set <code className="bg-slate-200 px-1 rounded">JIRA_URL_ACME=https://acme.atlassian.net</code> thì nhập <code className="bg-slate-200 px-1 rounded">JIRA_URL_ACME</code> vào ô dưới.
            </p>
            <div>
              <Label>Tên biến Base URL <span className="text-red-500">*</span></Label>
              <Input
                className="mt-1.5 font-mono"
                value={jiraForm.base_url_var}
                onChange={e => setJiraForm(f => ({ ...f, base_url_var: e.target.value.trim() }))}
                placeholder="VD: JIRA_URL_ACME"
              />
              <p className="text-xs text-slate-400 mt-1">Giá trị trỏ tới: <code>https://yourcompany.atlassian.net</code></p>
            </div>
            <div>
              <Label>Tên biến Email <span className="text-red-500">*</span></Label>
              <Input
                className="mt-1.5 font-mono"
                value={jiraForm.email_var}
                onChange={e => setJiraForm(f => ({ ...f, email_var: e.target.value.trim() }))}
                placeholder="VD: JIRA_EMAIL_ACME"
              />
              <p className="text-xs text-slate-400 mt-1">Giá trị là email đăng nhập Jira</p>
            </div>
            <div>
              <Label>Tên biến API Token <span className="text-red-500">*</span></Label>
              <Input
                className="mt-1.5 font-mono"
                value={jiraForm.token_var}
                onChange={e => setJiraForm(f => ({ ...f, token_var: e.target.value.trim() }))}
                placeholder="VD: JIRA_TOKEN_ACME"
              />
              <p className="text-xs text-slate-400 mt-1">Lấy token tại: id.atlassian.com → Security → API tokens</p>
            </div>

            {jiraTestResult && (
              <div className={`flex items-start gap-2 text-sm rounded-lg p-3 ${jiraTestResult.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {jiraTestResult.ok
                  ? <CheckCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  : <Loader2 className="h-4 w-4 shrink-0 mt-0.5 opacity-0" />}
                {jiraTestResult.message}
              </div>
            )}
          </div>
          <DialogFooter className="flex justify-between items-center">
            <Button variant="outline" onClick={testJiraConfig} disabled={jiraTesting}
              className="gap-1.5 text-violet-600 border-violet-200 hover:bg-violet-50">
              {jiraTesting
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang kiểm tra...</>
                : <><Link2 className="h-3.5 w-3.5" /> Kiểm tra kết nối</>}
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setJiraOpen(false)}>Huỷ</Button>
              <Button onClick={saveJiraConfig} className="bg-violet-600 hover:bg-violet-700"
                disabled={!jiraForm.base_url_var || !jiraForm.email_var || !jiraForm.token_var}>
                Lưu cấu hình
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── RAG Config Dialog ──────────────────────────────────────────────── */}
      <Dialog open={ragOpen} onOpenChange={setRagOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-emerald-600" />
              Cấu hình RAG — {ragCompany?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3 leading-relaxed">
              Điều chỉnh ngưỡng tính chỉ số sức khỏe RAG cho công ty này. <strong>SPI</strong> (Schedule Performance Index) = tiến độ thực tế / tiến độ kỳ vọng theo thời gian.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'spi_red_threshold',   label: 'SPI → RED',           hint: 'VD: 0.6 = tiến độ < 60% kỳ vọng', step: '0.05', min: '0.1', max: '0.99' },
                { key: 'spi_amber_threshold', label: 'SPI → AMBER',         hint: 'VD: 0.8 = tiến độ < 80% kỳ vọng', step: '0.05', min: '0.1', max: '0.99' },
                { key: 'deadline_red_days',   label: 'Deadline RED (ngày)',  hint: '0 = đã quá hạn',                  step: '1',    min: '-365', max: '30' },
                { key: 'deadline_amber_days', label: 'Deadline AMBER (ngày)',hint: 'Còn ≤ X ngày thì AMBER',          step: '1',    min: '1',   max: '90' },
                { key: 'risks_red',           label: 'Risks → RED',         hint: '≥ X risk mở',                     step: '1',    min: '1',   max: '20' },
                { key: 'risks_amber',         label: 'Risks → AMBER',       hint: '≥ X risk mở',                     step: '1',    min: '1',   max: '10' },
                { key: 'issues_amber',        label: 'Issues → AMBER',      hint: '≥ X issue mở',                    step: '1',    min: '1',   max: '10' },
                { key: 'low_progress_amber',  label: 'Tiến độ thấp → AMBER',hint: '< X% khi SPI không tính được',    step: '5',    min: '0',   max: '80' },
              ] as const).map(({ key, label, hint, step, min, max }) => (
                <div key={key}>
                  <Label className="text-xs">{label}</Label>
                  <Input
                    type="number" step={step} min={min} max={max}
                    className="mt-1 h-8 text-sm"
                    value={ragForm[key]}
                    onChange={(e: { target: { value: string } }) => setRagForm((f: RagForm) => ({ ...f, [key]: parseFloat(e.target.value) }))}
                  />
                  <p className="text-[10px] text-slate-400 mt-0.5">{hint}</p>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter className="flex justify-between items-center">
            <Button variant="outline" onClick={() => setRagForm(DEFAULT_RAG)} className="text-xs text-slate-500">
              Reset mặc định
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setRagOpen(false)}>Huỷ</Button>
              <Button onClick={saveRagConfig} className="bg-emerald-600 hover:bg-emerald-700">Lưu cấu hình</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reset Password Dialog ───────────────────────────────────────────── */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-amber-500" />
              Reset Password — {resetUser?.username}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>New Password <span className="text-red-500">*</span></Label>
              <Input className="mt-1.5" type="password" value={resetPwd}
                onChange={e => setResetPwd(e.target.value)}
                placeholder="Min. 8 characters" autoFocus />
            </div>
            <div>
              <Label>Confirm Password <span className="text-red-500">*</span></Label>
              <Input className="mt-1.5" type="password" value={resetConfirm}
                onChange={e => setResetConfirm(e.target.value)}
                placeholder="Repeat new password"
                onKeyDown={e => e.key === 'Enter' && doResetPwd()} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>Cancel</Button>
            <Button onClick={doResetPwd} className="bg-amber-600 hover:bg-amber-700">
              Reset Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── User Dialog ─────────────────────────────────────────────────────── */}
      <Dialog open={userOpen} onOpenChange={setUserOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editUser ? `Edit User — ${editUser.username}` : 'Add User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editUser && (
              <div>
                <Label>Username <span className="text-red-500">*</span></Label>
                <Input className="mt-1.5 font-mono" value={userForm.username}
                  onChange={e => setUserForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="e.g. ct_user2" autoFocus />
              </div>
            )}
            <div>
              <Label>Email <span className="text-red-500">*</span></Label>
              <Input className="mt-1.5" type="email" value={userForm.email}
                onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                placeholder="e.g. user@company.com" />
            </div>
            <div>
              <Label>Display Name</Label>
              <Input className="mt-1.5" value={userForm.display_name}
                onChange={e => setUserForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="e.g. Nguyen Van A" />
            </div>
            <div>
              <Label>{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</Label>
              <Input className="mt-1.5" type="password" value={userForm.password}
                onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editUser ? 'Leave blank to keep current' : 'Min. 8 characters'} />
            </div>
            <div>
              <Label>Status</Label>
              <select
                className="mt-1.5 w-full text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={userForm.status}
                onChange={e => setUserForm(f => ({ ...f, status: e.target.value as UserStatus }))}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="locked">Locked</option>
              </select>
            </div>
            <div>
              <Label>Roles <span className="text-red-500">*</span></Label>
              <div className="mt-2 flex flex-col gap-2">
                {ALL_ROLES.map(role => (
                  <label key={role} className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={userForm.roles.includes(role)}
                      onChange={() => toggleRole(role)}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm font-medium text-slate-700">{ROLE_LABELS[role]}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUserOpen(false)}>Cancel</Button>
            <Button onClick={saveUser} className="bg-blue-600 hover:bg-blue-700">
              {editUser ? 'Save Changes' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
