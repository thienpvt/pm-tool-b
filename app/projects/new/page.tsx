'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, Check, Building2, Plus } from 'lucide-react';
import Link from 'next/link';

const STEPS = ['Project Info', 'Team & Timeline', 'Confirm'];

type Customer = { id: number; name: string; industry: string; };

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState({
    name: '', client: '', customer_id: '', description: '',
    pm_name: '', pm_email: '',
    start_date: '', end_date: '',
    current_phase: 'Initiation',
  });

  useEffect(() => {
    fetch('/api/customers').then(r => r.json()).then(setCustomers);
  }, []);

  const set = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const selectedCustomer = customers.find(c => String(c.id) === form.customer_id);

  const handleSubmit = async () => {
    if (!form.name.trim()) { toast.error('Project name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        customer_id: form.customer_id ? Number(form.customer_id) : null,
        client: selectedCustomer?.name || form.client,
      };
      const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success('Project created!');
      router.push(`/projects/${data.id}`);
    } catch (e) {
      toast.error(String(e));
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-8 max-w-2xl">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">New Project</h1>
        <p className="text-slate-500 text-sm mb-8">Điền thông tin để khởi tạo project mới</p>

        {/* Step indicator */}
        <div className="flex items-center gap-0 mb-8">
          {STEPS.map((s, i) => (
            <div key={s} className="flex items-center">
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                i === step ? 'bg-blue-600 text-white' :
                i < step ? 'bg-blue-100 text-blue-700' :
                'bg-slate-100 text-slate-400'
              }`}>
                {i < step ? <Check className="h-3 w-3" /> : <span className="text-xs">{i + 1}</span>}
                {s}
              </div>
              {i < STEPS.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300 mx-1" />}
            </div>
          ))}
        </div>

        <Card className="p-6">
          {step === 0 && (
            <div className="space-y-5">
              {/* Customer select */}
              <div>
                <Label>Customer *</Label>
                <div className="flex gap-2 mt-1.5">
                  <Select value={form.customer_id} onValueChange={v => set('customer_id', (v ?? '') === 'none' ? '' : (v ?? ''))}>
                    <SelectTrigger className="flex-1">
                      {selectedCustomer ? (
                        <span className="flex items-center gap-1.5 text-sm">
                          <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span className="font-medium">{selectedCustomer.name}</span>
                          {selectedCustomer.industry && <span className="text-xs text-slate-400">· {selectedCustomer.industry}</span>}
                        </span>
                      ) : (
                        <SelectValue placeholder="Select customer..." />
                      )}
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none"><span className="text-slate-400 italic">— No customer —</span></SelectItem>
                      {customers.map(c => (
                        <SelectItem key={c.id} value={String(c.id)}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="font-medium">{c.name}</span>
                            {c.industry && <span className="text-xs text-slate-400">· {c.industry}</span>}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Link href="/customers">
                    <Button type="button" variant="outline" size="icon" title="Manage customers">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
                {customers.length === 0 && (
                  <p className="text-xs text-slate-400 mt-1.5">
                    No customers yet. <Link href="/customers" className="text-blue-600 hover:underline">Create one first</Link>.
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="name">Project Name *</Label>
                <Input id="name" className="mt-1.5" placeholder="e.g. Bank Platform Optimization" value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" className="mt-1.5" rows={3} placeholder="Mô tả ngắn về project..." value={form.description} onChange={e => set('description', e.target.value)} />
              </div>
              <div>
                <Label>Current Phase</Label>
                <Select value={form.current_phase} onValueChange={v => set('current_phase', v ?? 'Initiation')}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Initiation">Initiation</SelectItem>
                    <SelectItem value="Planning">Planning</SelectItem>
                    <SelectItem value="Execution">Execution</SelectItem>
                    <SelectItem value="Closing">Closing</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="pm_name">Project Manager</Label>
                  <Input id="pm_name" className="mt-1.5" placeholder="Nguyễn Văn A" value={form.pm_name} onChange={e => set('pm_name', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="pm_email">PM Email</Label>
                  <Input id="pm_email" className="mt-1.5" type="email" placeholder="pm@chartertech.com" value={form.pm_email} onChange={e => set('pm_email', e.target.value)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date">Start Date</Label>
                  <Input id="start_date" className="mt-1.5" type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="end_date">End Date</Label>
                  <Input id="end_date" className="mt-1.5" type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-700">Xác nhận thông tin</h3>
              <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                {selectedCustomer && (
                  <div className="flex gap-2"><span className="text-slate-500 w-36 shrink-0">Customer:</span><span className="font-medium text-blue-700">{selectedCustomer.name}</span></div>
                )}
                <div className="flex gap-2"><span className="text-slate-500 w-36 shrink-0">Project Name:</span><span className="font-medium">{form.name}</span></div>
                <div className="flex gap-2"><span className="text-slate-500 w-36 shrink-0">Phase:</span><span>{form.current_phase}</span></div>
                <div className="flex gap-2"><span className="text-slate-500 w-36 shrink-0">PM:</span><span>{form.pm_name || '—'} {form.pm_email ? `(${form.pm_email})` : ''}</span></div>
                <div className="flex gap-2"><span className="text-slate-500 w-36 shrink-0">Timeline:</span><span>{form.start_date || '—'} → {form.end_date || '—'}</span></div>
                {form.description && <div className="flex gap-2"><span className="text-slate-500 w-36 shrink-0">Description:</span><span>{form.description}</span></div>}
              </div>
              <p className="text-xs text-slate-400">Sau khi tạo, bạn có thể thêm team members, activities, risks... từ dashboard project.</p>
            </div>
          )}
        </Card>

        <div className="flex justify-between mt-6">
          <Button variant="outline" onClick={() => step > 0 ? setStep(s => s - 1) : router.push('/')} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> {step === 0 ? 'Cancel' : 'Back'}
          </Button>
          {step < STEPS.length - 1 ? (
            <Button onClick={() => setStep(s => s + 1)} className="bg-blue-600 hover:bg-blue-700 gap-2">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving} className="bg-green-600 hover:bg-green-700 gap-2">
              {saving ? 'Creating...' : 'Create Project'} <Check className="h-4 w-4" />
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}
