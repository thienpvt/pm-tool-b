'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, KeyRound, Building2, Users, ShieldCheck, ClipboardList, CheckCircle2, Clock, XCircle, Phone, Mail, MessageSquare } from 'lucide-react';

type Company = { id: number; name: string; user_count: number };
type User = { id: number; username: string; display_name: string; company_id: number | null; company_name: string | null; is_admin: number };
type Me = { id: number; username: string; is_admin: number };
type DemoRequest = { id: number; full_name: string; phone: string; email: string; company_name: string; status: string; notes: string; created_at: string };

const EMPTY_USER = { username: '', display_name: '', company_id: '', is_admin: false, password: '' };

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: 'Chờ xử lý',  color: 'bg-amber-50 text-amber-700 border-amber-200',  icon: <Clock className="h-3 w-3" /> },
  contacted: { label: 'Đã liên hệ', color: 'bg-blue-50 text-blue-700 border-blue-200',     icon: <CheckCircle2 className="h-3 w-3" /> },
  rejected:  { label: 'Đã từ chối', color: 'bg-slate-100 text-slate-500 border-slate-200', icon: <XCircle className="h-3 w-3" /> },
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

  const loadCompanies = useCallback(() =>
    fetch('/api/admin/companies').then(r => r.json()).then(setCompanies), []);
  const loadUsers = useCallback(() =>
    fetch('/api/admin/users').then(r => r.json()).then(setUsers), []);
  const loadDemoRequests = useCallback(() =>
    fetch('/api/admin/demo-requests').then(r => r.json()).then(setDemoRequests), []);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then((data: Me) => {
      if (!data || !data.is_admin) { router.replace('/'); return; }
      setMe(data);
    });
    loadCompanies();
    loadUsers();
    loadDemoRequests();
  }, [router, loadCompanies, loadUsers, loadDemoRequests]);

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

  // ── Users ──────────────────────────────────────────────────────────────────
  const openAddUser = () => { setEditUser(null); setUserForm(EMPTY_USER); setUserOpen(true); };
  const openEditUser = (u: User) => {
    setEditUser(u);
    setUserForm({ username: u.username, display_name: u.display_name, company_id: u.company_id ? String(u.company_id) : '', is_admin: !!u.is_admin, password: '' });
    setUserOpen(true);
  };

  const saveUser = async () => {
    if (!editUser && (!userForm.username.trim() || !userForm.password)) {
      toast.error('Username and password required'); return;
    }
    const body = {
      ...(editUser ? { id: editUser.id } : { username: userForm.username.trim() }),
      display_name: userForm.display_name,
      company_id: userForm.company_id ? Number(userForm.company_id) : null,
      is_admin: userForm.is_admin,
      ...(userForm.password ? { password: userForm.password } : {}),
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
    if (resetPwd.length < 6) { toast.error('Password must be at least 6 characters'); return; }
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
    if (u.id === me?.id) { toast.error('Cannot delete yourself'); return; }
    if (!confirm(`Delete user "${u.username}"?`)) return;
    const res = await fetch(`/api/admin/users?id=${u.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('User deleted');
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
    toast.success('Đã cập nhật trạng thái');
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
    toast.success('Đã lưu ghi chú');
    setNoteOpen(false);
    loadDemoRequests();
  };

  const deleteRequest = async (req: DemoRequest) => {
    if (!confirm(`Xóa yêu cầu của "${req.full_name}"?`)) return;
    await fetch(`/api/admin/demo-requests?id=${req.id}`, { method: 'DELETE' });
    toast.success('Đã xóa');
    loadDemoRequests();
  };

  if (!me) return null;

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
            <p className="text-sm text-slate-500">Manage users and companies</p>
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
            Yêu cầu trải nghiệm
            {demoRequests.filter(r => r.status === 'pending').length > 0 && (
              <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {demoRequests.filter(r => r.status === 'pending').length}
              </span>
            )}
          </button>
        </div>

        {/* ── Users tab ───────────────────────────────────────────────────── */}
        {tab === 'users' && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold text-slate-700">All Users</h2>
              <Button onClick={openAddUser} className="h-8 text-xs gap-1.5 bg-blue-600 hover:bg-blue-700">
                <Plus className="h-3.5 w-3.5" /> Add User
              </Button>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[500px]">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                  <th className="px-5 py-3">Username</th>
                  <th className="px-5 py-3">Display Name</th>
                  <th className="px-5 py-3">Company</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3 w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {users.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono font-medium text-slate-800">{u.username}</td>
                    <td className="px-5 py-3 text-slate-600">{u.display_name || '—'}</td>
                    <td className="px-5 py-3">
                      {u.company_name
                        ? <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-medium">{u.company_name}</span>
                        : <span className="text-slate-400 text-xs">No company</span>}
                    </td>
                    <td className="px-5 py-3">
                      {u.is_admin
                        ? <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded text-xs font-semibold">Admin</span>
                        : <span className="text-slate-400 text-xs">User</span>}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEditUser(u)} className="text-slate-400 hover:text-blue-600 transition-colors" title="Edit">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => openResetPwd(u)} className="text-slate-400 hover:text-amber-600 transition-colors" title="Reset password">
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteUser(u)} className="text-slate-400 hover:text-red-500 transition-colors" title="Delete" disabled={u.id === me?.id}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No users yet</td></tr>
                )}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {/* ── Companies tab ────────────────────────────────────────────────── */}
        {tab === 'companies' && (
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
                        <button onClick={() => openEditCompany(c)} className="text-slate-400 hover:text-blue-600 transition-colors">
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button onClick={() => deleteCompany(c)} className="text-slate-400 hover:text-red-500 transition-colors">
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
        {tab === 'requests' && (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b">
              <h2 className="font-semibold text-slate-700">Yêu cầu đăng ký trải nghiệm</h2>
              <span className="text-xs text-slate-400">{demoRequests.length} yêu cầu</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase tracking-wide">
                    <th className="px-5 py-3">Họ tên</th>
                    <th className="px-5 py-3">Công ty</th>
                    <th className="px-5 py-3">Liên hệ</th>
                    <th className="px-5 py-3">Trạng thái</th>
                    <th className="px-5 py-3">Ngày gửi</th>
                    <th className="px-5 py-3 w-36">Thao tác</th>
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
                            <option value="pending">Chờ xử lý</option>
                            <option value="contacted">Đã liên hệ</option>
                            <option value="rejected">Đã từ chối</option>
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
                              title={r.notes ? `Ghi chú: ${r.notes}` : 'Thêm ghi chú'}
                            >
                              <MessageSquare className={`h-4 w-4 ${r.notes ? 'text-blue-400' : ''}`} />
                            </button>
                            <button onClick={() => deleteRequest(r)} className="text-slate-400 hover:text-red-500 transition-colors" title="Xóa">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {demoRequests.length === 0 && (
                    <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400">Chưa có yêu cầu nào</td></tr>
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
              Ghi chú — {noteRequest?.full_name}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Label>Nội dung ghi chú</Label>
            <textarea
              className="mt-1.5 w-full text-sm border rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-400 min-h-[80px] resize-none"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              placeholder="Nhập ghi chú về yêu cầu này..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteOpen(false)}>Hủy</Button>
            <Button onClick={saveNote} className="bg-blue-600 hover:bg-blue-700">Lưu ghi chú</Button>
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
                placeholder="Min. 6 characters" autoFocus />
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
              <Label>Display Name</Label>
              <Input className="mt-1.5" value={userForm.display_name}
                onChange={e => setUserForm(f => ({ ...f, display_name: e.target.value }))}
                placeholder="e.g. Nguyen Van A" />
            </div>
            <div>
              <Label>{editUser ? 'New Password (leave blank to keep)' : 'Password *'}</Label>
              <Input className="mt-1.5" type="password" value={userForm.password}
                onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                placeholder={editUser ? 'Leave blank to keep current' : 'Set password'} />
            </div>
            <div>
              <Label>Company</Label>
              <select
                className="mt-1.5 w-full text-sm border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400"
                value={userForm.company_id}
                onChange={e => setUserForm(f => ({ ...f, company_id: e.target.value }))}
              >
                <option value="">— No company (Admin only) —</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" checked={userForm.is_admin}
                onChange={e => setUserForm(f => ({ ...f, is_admin: e.target.checked }))}
                className="w-4 h-4 rounded" />
              <span className="text-sm font-medium text-slate-700">Grant admin access</span>
            </label>
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
