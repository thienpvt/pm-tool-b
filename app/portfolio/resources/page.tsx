'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Plus, Trash2, Upload, Search, Users, Building2, Download, Target } from 'lucide-react';
import PortfolioImportDialog from '@/components/resources/PortfolioImportDialog';

type PortfolioMember = {
  id: number;
  role: string;
  name: string;
  email: string;
  note: string;
  member_type: string;
};

// ── Quota summary bar ──────────────────────────────────────────────────────────
function QuotaBar({ quota, used, onQuotaChange }: { quota: number; used: number; onQuotaChange: (v: number) => void }) {
  const remaining = quota - used;
  const pct = quota > 0 ? Math.min((used / quota) * 100, 100) : 0;
  const overAllocated = remaining < 0;
  const atLimit = remaining === 0 && quota > 0;

  return (
    <div className="flex items-center gap-4 flex-wrap bg-slate-50 border rounded-xl px-4 py-3 mb-4">
      <div className="flex items-center gap-2">
        <Target className="h-4 w-4 text-blue-500 shrink-0" />
        <span className="text-xs text-slate-500 font-medium">Định biên khối:</span>
        <input
          type="number"
          min={0}
          className="w-16 h-6 px-1.5 text-xs font-bold text-slate-800 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 text-center bg-white"
          value={quota || ''}
          placeholder="0"
          onChange={e => onQuotaChange(Math.max(0, Number(e.target.value) || 0))}
        />
      </div>
      <div className="h-4 w-px bg-slate-200" />
      <div className="text-xs">
        <span className="text-slate-400">Đã phân bổ: </span>
        <span className="font-bold text-slate-700">{used}</span>
      </div>
      <div className="h-4 w-px bg-slate-200" />
      <div className="text-xs">
        <span className="text-slate-400">Còn lại: </span>
        <span className={`font-bold ${overAllocated ? 'text-red-600' : atLimit ? 'text-amber-600' : 'text-green-600'}`}>
          {remaining}
        </span>
      </div>
      {quota > 0 && (
        <>
          <div className="h-4 w-px bg-slate-200" />
          <div className="flex items-center gap-2 flex-1 min-w-[120px]">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${overAllocated ? 'bg-red-500' : atLimit ? 'bg-amber-400' : 'bg-green-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className={`text-[10px] font-medium tabular-nums ${overAllocated ? 'text-red-600' : atLimit ? 'text-amber-600' : 'text-slate-500'}`}>
              {pct.toFixed(0)}%
            </span>
          </div>
        </>
      )}
    </div>
  );
}

type MemberTableProps = {
  members: PortfolioMember[];
  loading: boolean;
  search: string;
  memberType: 'internal' | 'external';
  onUpdateField: (id: number, field: keyof PortfolioMember, value: string) => void;
  onSaveRow: (row: PortfolioMember) => void;
  onDeleteRow: (id: number) => void;
  onAddClick: () => void;
  onImportClick: () => void;
};

function MemberTable({
  members, loading, search, memberType,
  onUpdateField, onSaveRow, onDeleteRow, onAddClick, onImportClick,
}: MemberTableProps) {
  const filtered = members.filter(m => {
    if (m.member_type !== memberType) return false;
    const q = search.toLowerCase();
    return !q
      || m.name.toLowerCase().includes(q)
      || m.role.toLowerCase().includes(q)
      || m.email.toLowerCase().includes(q)
      || m.note.toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <span className="text-xs text-slate-400">
          {filtered.length} / {members.filter(m => m.member_type === memberType).length} member{members.filter(m => m.member_type === memberType).length !== 1 ? 's' : ''}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onImportClick} className="gap-2 h-8 text-xs">
            <Upload className="h-3.5 w-3.5" /> Import
          </Button>
          <Button onClick={onAddClick} className="bg-blue-600 hover:bg-blue-700 gap-2 h-8 text-xs">
            <Plus className="h-3.5 w-3.5" /> Add Member
          </Button>
        </div>
      </div>

      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs min-w-max">
            <thead>
              <tr className="bg-[#1e293b] text-white">
                <th className="px-3 py-3 text-left w-8">#</th>
                <th className="px-3 py-3 text-left w-36">Role</th>
                <th className="px-3 py-3 text-left w-44">Name</th>
                <th className="px-3 py-3 text-left w-52">Email</th>
                <th className="px-3 py-3 text-left">Note</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">Loading...</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-slate-400">
                    {members.filter(m => m.member_type === memberType).length === 0
                      ? 'No members yet. Click "Add Member" or "Import" to get started.'
                      : 'No members match your search.'}
                  </td>
                </tr>
              ) : (
                filtered.map((row, i) => (
                  <tr key={row.id} className={`border-t hover:bg-slate-50 ${i % 2 ? 'bg-slate-50/40' : ''}`}>
                    <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-6 text-xs"
                        value={row.role}
                        placeholder="Role"
                        onChange={e => onUpdateField(row.id, 'role', e.target.value)}
                        onBlur={() => onSaveRow(row)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-6 text-xs font-medium"
                        value={row.name}
                        placeholder="Name"
                        onChange={e => onUpdateField(row.id, 'name', e.target.value)}
                        onBlur={() => onSaveRow(row)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-6 text-xs"
                        value={row.email}
                        placeholder="email@company.com"
                        type="email"
                        onChange={e => onUpdateField(row.id, 'email', e.target.value)}
                        onBlur={() => onSaveRow(row)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        className="h-6 text-xs"
                        value={row.note}
                        placeholder="Note"
                        onChange={e => onUpdateField(row.id, 'note', e.target.value)}
                        onBlur={() => onSaveRow(row)}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        onClick={() => onDeleteRow(row.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function PortfolioResourcesPage() {
  const [members, setMembers] = useState<PortfolioMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [importOpen, setImportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [addMemberType, setAddMemberType] = useState<'internal' | 'external'>('internal');
  const [addForm, setAddForm] = useState({ role: '', name: '', email: '', note: '' });
  const [addSaving, setAddSaving] = useState(false);
  const [quota, setQuota] = useState(0);
  const [quotaSaving, setQuotaSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [membersRes, quotaRes] = await Promise.all([
        fetch('/api/portfolio/members').then(r => r.json()),
        fetch('/api/portfolio/quota').then(r => r.json()),
      ]);
      setMembers(Array.isArray(membersRes) ? membersRes : []);
      setQuota(quotaRes.headcount_quota ?? 0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateField = (id: number, field: keyof PortfolioMember, value: string) => {
    setMembers(ms => ms.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  const saveRow = async (row: PortfolioMember) => {
    await fetch(`/api/portfolio/members/${row.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(row),
    });
  };

  const deleteRow = async (id: number) => {
    await fetch(`/api/portfolio/members/${id}`, { method: 'DELETE' });
    setMembers(ms => ms.filter(m => m.id !== id));
    toast.success('Member removed');
  };

  const openAdd = (type: 'internal' | 'external') => {
    setAddMemberType(type);
    setAddForm({ role: '', name: '', email: '', note: '' });
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!addForm.name.trim()) { toast.error('Name is required'); return; }
    setAddSaving(true);
    try {
      const res = await fetch('/api/portfolio/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, member_type: addMemberType }),
      });
      if (!res.ok) { toast.error((await res.json()).error); return; }
      toast.success('Member added');
      setAddOpen(false);
      load();
    } finally {
      setAddSaving(false);
    }
  };

  const saveQuota = async (value: number) => {
    if (quotaSaving) return;
    setQuotaSaving(true);
    try {
      await fetch('/api/portfolio/quota', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ headcount_quota: value }),
      });
    } finally {
      setQuotaSaving(false);
    }
  };

  const handleQuotaChange = (value: number) => {
    setQuota(value);
    saveQuota(value);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/export/portfolio/members');
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ResourceManagement.xlsx';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Exported successfully!');
    } catch (e) {
      toast.error(String(e));
    } finally {
      setExporting(false);
    }
  };

  const internalCount = members.filter(m => m.member_type === 'internal').length;
  const externalCount = members.filter(m => m.member_type === 'external').length;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 overflow-x-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
          <div>
            <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Resource Management
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              Danh sách nhân sự cấp portfolio — sử dụng để phân bổ vào các project
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={exporting || members.length === 0}
            className="gap-2 h-9 text-sm text-emerald-700 border-emerald-300 hover:bg-emerald-50"
          >
            <Download className={`h-4 w-4 ${exporting ? 'animate-bounce' : ''}`} />
            {exporting ? 'Exporting...' : 'Export .xlsx'}
          </Button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              className="pl-8 h-8 text-sm"
              placeholder="Search name, role, email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="internal">
          <TabsList className="mb-4">
            <TabsTrigger value="internal" className="gap-2">
              <Users className="h-3.5 w-3.5" />
              Nhân sự trong khối
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold">{internalCount}</span>
            </TabsTrigger>
            <TabsTrigger value="external" className="gap-2">
              <Building2 className="h-3.5 w-3.5" />
              Nhân sự ngoài khối
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{externalCount}</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="internal">
            <p className="text-xs text-slate-400 mb-3">Nhân sự nội bộ — được phân bổ trực tiếp vào các dự án trong portfolio.</p>
            <QuotaBar
              quota={quota}
              used={internalCount}
              onQuotaChange={handleQuotaChange}
            />
            <MemberTable
              members={members}
              loading={loading}
              search={search}
              memberType="internal"
              onUpdateField={updateField}
              onSaveRow={saveRow}
              onDeleteRow={deleteRow}
              onAddClick={() => openAdd('internal')}
              onImportClick={() => setImportOpen(true)}
            />
          </TabsContent>

          <TabsContent value="external">
            <p className="text-xs text-slate-400 mb-3">Nhân sự mượn ngoài khối — nguồn lực hỗ trợ từ bên ngoài tổ chức.</p>
            <MemberTable
              members={members}
              loading={loading}
              search={search}
              memberType="external"
              onUpdateField={updateField}
              onSaveRow={saveRow}
              onDeleteRow={deleteRow}
              onAddClick={() => openAdd('external')}
              onImportClick={() => setImportOpen(true)}
            />
          </TabsContent>
        </Tabs>

        <p className="text-xs text-slate-400 mt-4">
          Nhân sự trong danh sách này có thể được chọn trực tiếp trong Resource Plan của từng project — gõ tên hoặc email để tìm kiếm.
        </p>
      </main>

      {/* Import Dialog */}
      <PortfolioImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={load}
      />

      {/* Add Member Dialog */}
      <Dialog open={addOpen} onOpenChange={o => { if (!o) setAddOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add {addMemberType === 'external' ? 'External' : 'Internal'} Member
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Name *</Label>
              <Input
                className="mt-1.5"
                value={addForm.name}
                onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Full name"
                autoFocus
              />
            </div>
            <div>
              <Label>Role</Label>
              <Input
                className="mt-1.5"
                value={addForm.role}
                onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))}
                placeholder="e.g. Frontend Developer"
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                className="mt-1.5"
                type="email"
                value={addForm.email}
                onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                placeholder="email@company.com"
              />
            </div>
            <div>
              <Label>Note</Label>
              <Input
                className="mt-1.5"
                value={addForm.note}
                onChange={e => setAddForm(f => ({ ...f, note: e.target.value }))}
                placeholder="Optional note"
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
            <Button onClick={handleAdd} disabled={addSaving || !addForm.name.trim()} className="bg-blue-600 hover:bg-blue-700">
              {addSaving ? 'Saving…' : 'Add Member'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
