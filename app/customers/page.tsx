'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  Plus, Pencil, Trash2, Building2, Mail, Phone, Globe,
  FolderKanban, ChevronRight, Search,
} from 'lucide-react';

type Customer = {
  id: number; name: string; industry: string;
  contact_name: string; contact_email: string; contact_phone: string;
  website: string; notes: string; created_at: string;
  project_count: number;
};

const INDUSTRIES = [
  'Banking & Finance', 'Insurance', 'Fintech', 'Retail', 'Healthcare',
  'Manufacturing', 'Telecommunications', 'Government', 'Education', 'Technology', 'Other',
];

const INDUSTRY_COLOR: Record<string, string> = {
  'Banking & Finance': 'bg-blue-100 text-blue-700',
  'Insurance': 'bg-purple-100 text-purple-700',
  'Fintech': 'bg-cyan-100 text-cyan-700',
  'Retail': 'bg-orange-100 text-orange-700',
  'Healthcare': 'bg-green-100 text-green-700',
  'Manufacturing': 'bg-yellow-100 text-yellow-700',
  'Telecommunications': 'bg-pink-100 text-pink-700',
  'Government': 'bg-slate-100 text-slate-700',
  'Education': 'bg-emerald-100 text-emerald-700',
  'Technology': 'bg-indigo-100 text-indigo-700',
};

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function avatarColor(name: string) {
  const colors = [
    'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
    'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-rose-500',
  ];
  let hash = 0;
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff;
  return colors[Math.abs(hash) % colors.length];
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

const EMPTY: Partial<Customer> = {
  name: '', industry: '', contact_name: '', contact_email: '',
  contact_phone: '', website: '', notes: '',
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [editing, setEditing] = useState<Partial<Customer> | null>(null);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState<Customer | null>(null);

  const load = useCallback(() => {
    fetch('/api/customers').then(r => r.json()).then(setCustomers);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!editing?.name?.trim()) { toast.error('Name is required'); return; }
    const isNew = !editing.id;
    const res = await fetch(isNew ? '/api/customers' : `/api/customers/${editing.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    if (!res.ok) { toast.error('Failed to save'); return; }
    load();
    setEditing(null);
    toast.success(isNew ? 'Customer created' : 'Customer updated');
  };

  const del = async (c: Customer) => {
    await fetch(`/api/customers/${c.id}`, { method: 'DELETE' });
    setCustomers(cs => cs.filter(x => x.id !== c.id));
    setDeleting(null);
    toast.success('Customer deleted');
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.industry.toLowerCase().includes(search.toLowerCase()) ||
    c.contact_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalProjects = customers.reduce((s, c) => s + c.project_count, 0);

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between gap-3 flex-wrap mb-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Building2 className="h-6 w-6 text-blue-600" /> Customer Management
              </h1>
              <p className="text-slate-500 text-sm mt-1">
                {customers.length} customers · {totalProjects} projects total
              </p>
            </div>
            <Button onClick={() => setEditing({ ...EMPTY })} className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="h-4 w-4" /> Add Customer
            </Button>
          </div>

          {/* Search */}
          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              className="pl-9 h-10 bg-white"
              placeholder="Search by name, industry, or contact..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Empty */}
          {filtered.length === 0 && (
            <div className="text-center py-24 rounded-2xl border bg-white">
              <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-200" />
              <p className="text-slate-400 text-sm">
                {search ? 'No customers match your search.' : 'No customers yet. Add your first customer!'}
              </p>
            </div>
          )}

          {/* Customer grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map(c => (
              <div key={c.id} className="bg-white rounded-2xl border hover:shadow-md transition-shadow flex flex-col">
                {/* Card header */}
                <div className="p-5 flex items-start gap-4">
                  <div className={`w-12 h-12 rounded-xl ${avatarColor(c.name)} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
                    {initials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-slate-800 truncate">{c.name}</h3>
                    {c.industry && (
                      <Badge className={`text-[10px] mt-1 ${INDUSTRY_COLOR[c.industry] ?? 'bg-slate-100 text-slate-600'}`}>
                        {c.industry}
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => setEditing({ ...c })} className="p-1.5 text-slate-300 hover:text-blue-500 rounded transition-colors">
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => setDeleting(c)} className="p-1.5 text-slate-300 hover:text-red-500 rounded transition-colors">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Contact info */}
                <div className="px-5 pb-4 space-y-1.5 text-xs text-slate-500 flex-1">
                  {c.contact_name && (
                    <div className="flex items-center gap-2">
                      <span className="w-4 text-slate-300">👤</span>{c.contact_name}
                    </div>
                  )}
                  {c.contact_email && (
                    <div className="flex items-center gap-2 truncate">
                      <Mail className="h-3 w-3 shrink-0 text-slate-300" />
                      <a href={`mailto:${c.contact_email}`} className="truncate hover:text-blue-600">{c.contact_email}</a>
                    </div>
                  )}
                  {c.contact_phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-3 w-3 text-slate-300" />{c.contact_phone}
                    </div>
                  )}
                  {c.website && (
                    <div className="flex items-center gap-2 truncate">
                      <Globe className="h-3 w-3 shrink-0 text-slate-300" />
                      <a href={c.website} target="_blank" rel="noopener noreferrer" className="truncate hover:text-blue-600">{c.website.replace(/^https?:\/\//, '')}</a>
                    </div>
                  )}
                  {c.notes && (
                    <p className="text-slate-400 italic line-clamp-2 pt-1">{c.notes}</p>
                  )}
                </div>

                {/* Footer: project count + link */}
                <div className="px-5 py-3 border-t bg-slate-50/60 rounded-b-2xl flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <FolderKanban className="h-3.5 w-3.5 text-blue-400" />
                    <span className="font-semibold text-blue-600">{c.project_count}</span>
                    <span>{c.project_count === 1 ? 'project' : 'projects'}</span>
                  </div>
                  <Link href={`/?customer=${c.id}`} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-0.5">
                    View projects <ChevronRight className="h-3 w-3" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Add / Edit Dialog */}
      <Dialog open={!!editing} onOpenChange={o => { if (!o) setEditing(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500" />
              {editing?.id ? 'Edit Customer' : 'Add New Customer'}
            </DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-1">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <FieldRow label="Company Name *">
                    <Input className="h-9" value={editing.name ?? ''} onChange={e => setEditing(x => ({ ...x!, name: e.target.value }))} placeholder="e.g. VPBank" />
                  </FieldRow>
                </div>
                <FieldRow label="Industry">
                  <select
                    className="w-full h-9 px-3 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={editing.industry ?? ''}
                    onChange={e => setEditing(x => ({ ...x!, industry: e.target.value }))}
                  >
                    <option value="">Select industry...</option>
                    {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                  </select>
                </FieldRow>
                <FieldRow label="Contact Person">
                  <Input className="h-9" value={editing.contact_name ?? ''} onChange={e => setEditing(x => ({ ...x!, contact_name: e.target.value }))} placeholder="Nguyễn Văn A" />
                </FieldRow>
                <FieldRow label="Contact Email">
                  <Input className="h-9" type="email" value={editing.contact_email ?? ''} onChange={e => setEditing(x => ({ ...x!, contact_email: e.target.value }))} placeholder="contact@company.com" />
                </FieldRow>
                <FieldRow label="Phone">
                  <Input className="h-9" value={editing.contact_phone ?? ''} onChange={e => setEditing(x => ({ ...x!, contact_phone: e.target.value }))} placeholder="+84 xxx xxx xxx" />
                </FieldRow>
                <div className="col-span-2">
                  <FieldRow label="Website">
                    <Input className="h-9" value={editing.website ?? ''} onChange={e => setEditing(x => ({ ...x!, website: e.target.value }))} placeholder="https://company.com" />
                  </FieldRow>
                </div>
                <div className="col-span-2">
                  <FieldRow label="Notes">
                    <Textarea className="text-sm min-h-[72px]" value={editing.notes ?? ''} onChange={e => setEditing(x => ({ ...x!, notes: e.target.value }))} placeholder="Ghi chú thêm về khách hàng..." />
                  </FieldRow>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Hủy</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={save}>
              {editing?.id ? 'Cập nhật' : 'Tạo Customer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleting} onOpenChange={o => { if (!o) setDeleting(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Xóa customer?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-600 py-2">
            Bạn có chắc muốn xóa <span className="font-semibold">{deleting?.name}</span>?
            Các projects của customer này sẽ không bị xóa nhưng sẽ mất liên kết.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Hủy</Button>
            <Button variant="destructive" onClick={() => deleting && del(deleting)}>Xóa</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
