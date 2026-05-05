'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, KeyRound, Building2, Users, ShieldCheck } from 'lucide-react';

type Company = { id: number; name: string; user_count: number };
type User = { id: number; username: string; display_name: string; company_id: number | null; company_name: string | null; is_admin: number };
type Me = { id: number; username: string; is_admin: number };

const EMPTY_USER = { username: '', display_name: '', company_id: '', is_admin: false, password: '' };

export default function AdminPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [tab, setTab] = useState<'users' | 'companies'>('users');

  // Company dialog
  const [companyOpen, setCompanyOpen] = useState(false);
  const [editCompany, setEditCompany] = useState<Company | null>(null);
  const [companyName, setCompanyName] = useState('');

  // User dialog
  const [userOpen, setUserOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [userForm, setUserForm] = useState(EMPTY_USER);

  const loadCompanies = useCallback(() =>
    fetch('/api/admin/companies').then(r => r.json()).then(setCompanies), []);
  const loadUsers = useCallback(() =>
    fetch('/api/admin/users').then(r => r.json()).then(setUsers), []);

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then((data: Me) => {
      if (!data || !data.is_admin) { router.replace('/'); return; }
      setMe(data);
    });
    loadCompanies();
    loadUsers();
  }, [router, loadCompanies, loadUsers]);

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

  const deleteUser = async (u: User) => {
    if (u.id === me?.id) { toast.error('Cannot delete yourself'); return; }
    if (!confirm(`Delete user "${u.username}"?`)) return;
    const res = await fetch(`/api/admin/users?id=${u.id}`, { method: 'DELETE' });
    if (!res.ok) { toast.error((await res.json()).error); return; }
    toast.success('User deleted');
    loadUsers();
  };

  if (!me) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">
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
          {(['users', 'companies'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize flex items-center gap-2 ${tab === t ? 'bg-white shadow-sm text-slate-800' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {t === 'users' ? <Users className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
              {t === 'users' ? `Users (${users.length})` : `Companies (${companies.length})`}
            </button>
          ))}
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
            <table className="w-full text-sm">
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
                        <button onClick={() => { setEditUser(u); setUserForm({ ...EMPTY_USER, display_name: u.display_name, company_id: u.company_id ? String(u.company_id) : '', is_admin: !!u.is_admin }); setUserOpen(true); }} className="text-slate-400 hover:text-amber-600 transition-colors" title="Reset password">
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
            <table className="w-full text-sm">
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
        )}
      </main>

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
                placeholder="e.g. Chartertech Global" autoFocus
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
