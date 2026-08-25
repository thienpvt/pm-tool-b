'use client';
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Save, Plus, ChevronRight, X, Tag, Eye } from 'lucide-react';
import { statusPct, weightedProgress } from '@/lib/status-weights';
import type { Activity, TeamMember } from '../types';
import { STATUSES, PRIORITIES, PRIORITY_COLOR, STATUS_COLOR, PROJECT_STATUS_COLOR, DELAY_OWNERS } from '../types';
import { calcLag, LagBadge, DELAY_OWNER_COLOR } from './LagCalc';
import { progressColor } from './RoadmapHelpers';

export function ActivityDetail({
  activity, teamMembers, projectId, onSave, onDelete, onClose, childActivities = [],
  onCreateChild, onViewChild,
}: {
  activity: Activity; teamMembers: TeamMember[]; projectId: string;
  onSave: (updated: Activity) => void; onDelete: (id: number) => void; onClose: () => void;
  childActivities?: Activity[];
  onCreateChild?: (name: string) => Promise<Activity>;
  onViewChild?: (child: Activity) => void;
}) {
  const [form, setForm] = useState<Activity>(activity);
  const [saving, setSaving] = useState(false);
  const [isAddingChild, setIsAddingChild] = useState(false);
  const [newChildName, setNewChildName] = useState('');
  const [addingChild, setAddingChild] = useState(false);

  const upd = (field: keyof Activity, value: string | number) =>
    setForm(f => ({ ...f, [field]: value }));

  const lag = calcLag(form.plan_end, form.actual_end, form.status);

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/activities`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    onSave(form);
  };

  const handleAddChild = async () => {
    if (!newChildName.trim() || !onCreateChild) return;
    setAddingChild(true);
    try {
      await onCreateChild(newChildName.trim());
      setNewChildName('');
      setIsAddingChild(false);
    } finally {
      setAddingChild(false);
    }
  };

  const canAddChildren = !activity.parent_id;
  const fieldCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400';

  return (
    <div className="flex flex-col" style={{ maxHeight: '88vh' }}>
      {/* Header */}
      <div className="flex items-start justify-between px-6 py-4 border-b bg-slate-50 shrink-0">
        <div className="flex-1 min-w-0 pr-4">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {form.jira_key && (
              <span className="text-xs font-mono bg-white border border-slate-200 px-2 py-0.5 rounded text-slate-600 shrink-0">{form.jira_key}</span>
            )}
            {activity.parent_id && (
              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                <ChevronRight className="h-3 w-3 -mx-0.5" /> Sub-task
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_COLOR[form.status] ?? 'bg-slate-100 text-slate-500'}`}>{form.status}</span>
            {form.project_status && (
              <span className={`text-xs px-2 py-0.5 rounded-full border font-medium shrink-0 ${PROJECT_STATUS_COLOR[form.project_status] ?? 'bg-indigo-50 border-indigo-200 text-indigo-600'}`}>
                <Tag className="inline h-2.5 w-2.5 mr-0.5 -mt-px" />{form.project_status}
              </span>
            )}
            <span className="text-xs text-slate-400 shrink-0">{form.phase}</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800 leading-snug">
              {form.activity || <span className="italic text-slate-400 font-normal">Untitled Activity</span>}
            </h2>
            <Select value={form.priority || 'Medium'} onValueChange={v => upd('priority', v ?? 'Medium')}>
              <SelectTrigger className={`h-6 w-24 text-[11px] shrink-0 border font-semibold rounded-full px-2 ${PRIORITY_COLOR[form.priority] ?? PRIORITY_COLOR['Medium']}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITIES.map(p => (
                  <SelectItem key={p} value={p}>
                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border ${PRIORITY_COLOR[p] ?? ''}`}>{p}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <button onClick={onClose} className="shrink-0 p-1 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition-colors">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left column */}
        <div className="flex-1 p-6 overflow-y-auto space-y-5 border-r border-slate-100 min-w-0">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Activity</label>
            <textarea className={`${fieldCls} min-h-[70px] resize-y py-2 leading-relaxed`} value={form.activity} onChange={e => upd('activity', e.target.value)} placeholder="Activity description..." />
          </div>

          {/* Progress bar + children list */}
          {(() => {
            const pct = childActivities.length > 0
              ? weightedProgress(childActivities.map(c => c.status))
              : statusPct(form.status);
            const barFill = progressColor(pct);
            return (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Progress {childActivities.length > 0 ? '— weighted from children' : '— by status'}
                  </label>
                  {canAddChildren && onCreateChild && (
                    <button
                      onClick={() => setIsAddingChild(true)}
                      className="flex items-center gap-1 text-[10px] font-semibold text-white hover:opacity-90 px-2 py-0.5 rounded-full transition-opacity"
                      style={{ background: 'linear-gradient(90deg, #6366f1, #3b82f6)' }}
                    >
                      <Plus className="h-3 w-3" /> Add child
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex-1 bg-slate-200 rounded-full h-2.5 overflow-hidden">
                    <div className="h-2.5 rounded-full transition-all duration-300" style={{ width: `${pct}%`, background: barFill }} />
                  </div>
                  <span className="text-sm font-bold tabular-nums w-10 text-right" style={{ color: barFill }}>{pct}%</span>
                </div>

                {/* Children list */}
                {childActivities.length > 0 && (
                  <div className="space-y-1 mb-2">
                    {childActivities.map(child => (
                      <div
                        key={child.id}
                        className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-slate-50 border border-slate-100 cursor-pointer hover:bg-blue-50/60 hover:border-blue-200 transition-colors group/child"
                        onClick={() => onViewChild?.(child)}
                      >
                        {child.jira_key && (
                          <span className="text-[10px] font-mono text-slate-400 shrink-0 group-hover/child:text-blue-500">{child.jira_key}</span>
                        )}
                        <span className="text-xs text-slate-700 flex-1 truncate group-hover/child:text-blue-700">{child.activity || '—'}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold shrink-0 ${STATUS_COLOR[child.status] ?? 'bg-slate-100 text-slate-500'}`}>{child.status}</span>
                        <Eye className="h-3 w-3 text-slate-300 group-hover/child:text-blue-400 shrink-0 transition-colors" />
                      </div>
                    ))}
                  </div>
                )}

                {/* Inline add child */}
                {isAddingChild && (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      autoFocus
                      type="text"
                      value={newChildName}
                      onChange={e => setNewChildName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleAddChild();
                        if (e.key === 'Escape') { setIsAddingChild(false); setNewChildName(''); }
                      }}
                      placeholder="Child task name..."
                      className="flex-1 h-8 text-sm border border-blue-300 rounded-lg px-3 focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    />
                    <button
                      onClick={handleAddChild}
                      disabled={addingChild || !newChildName.trim()}
                      className="h-8 px-3 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {addingChild ? '…' : 'Add'}
                    </button>
                    <button
                      onClick={() => { setIsAddingChild(false); setNewChildName(''); }}
                      className="h-8 px-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            );
          })()}

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Deliverable</label>
            <input type="text" className={`${fieldCls} h-9`} value={form.deliverable} onChange={e => upd('deliverable', e.target.value)} placeholder="Expected deliverable..." />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Sign-off Document</label>
            <input type="text" className={`${fieldCls} h-9`} value={form.sign_off_doc} onChange={e => upd('sign_off_doc', e.target.value)} placeholder="Sign-off document..." />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Notes</label>
            <textarea className={`${fieldCls} min-h-[90px] resize-y py-2 leading-relaxed`} value={form.notes} onChange={e => upd('notes', e.target.value)} placeholder="Additional notes..." />
          </div>

          {/* Lag & Delay section */}
          <div className="rounded-xl border border-orange-100 bg-orange-50/40 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider">Lag &amp; Delay</p>
              <LagBadge lag={lag} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Delay Owner</label>
              <Select value={form.delay_owner || 'N/A'} onValueChange={v => upd('delay_owner', v ?? 'N/A')}>
                <SelectTrigger className={`h-9 text-sm ${form.delay_owner && form.delay_owner !== 'N/A' ? DELAY_OWNER_COLOR[form.delay_owner] : ''}`}><SelectValue /></SelectTrigger>
                <SelectContent>{DELAY_OWNERS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Delay Reason</label>
              <textarea
                className="w-full text-sm border border-orange-200/70 rounded-lg px-3 py-2 min-h-[75px] resize-y focus:outline-none focus:ring-2 focus:ring-orange-300 bg-white/80 leading-relaxed"
                value={form.delay_reason} onChange={e => upd('delay_reason', e.target.value)} placeholder="Describe the reason for delay..." />
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="w-80 shrink-0 p-5 overflow-y-auto bg-slate-50/40 space-y-5">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Status</label>
            <Select value={form.status} onValueChange={v => upd('status', v ?? '')}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {/* Schedule */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Schedule</p>
            <div className="grid grid-cols-2 gap-3">
              {([['Plan Start','plan_start'],['Plan End','plan_end'],['Actual Start','actual_start'],['Actual End','actual_end']] as [string, keyof Activity][]).map(([lbl, field]) => (
                <div key={field}>
                  <span className="text-[10px] text-slate-400 font-medium block mb-1">{lbl}</span>
                  <input type="date" value={(form[field] as string) ?? ''}
                    onChange={e => upd(field, e.target.value)}
                    className="h-7 w-full text-xs border border-slate-200 rounded px-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400" />
                </div>
              ))}
            </div>
          </div>

          {/* People */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">People</p>
            {([['Accountable','accountable'],['Responsible','responsible'],['Support','support']] as [string, keyof Activity][]).map(([lbl, field]) => (
              <div key={field}>
                <span className="text-[10px] text-slate-400 font-medium block mb-1">{lbl}</span>
                <input type="text" list={`team-${projectId}`}
                  value={(form[field] as string) ?? ''}
                  onChange={e => upd(field, e.target.value)}
                  className="h-7 w-full text-xs border border-slate-200 rounded px-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-blue-400"
                  placeholder="Select..." />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t bg-white px-6 py-3 flex items-center justify-between shrink-0">
        <button onClick={() => onDelete(form.id)}
          className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-700 transition-colors">
          <Trash2 className="h-4 w-4" /> Delete Activity
        </button>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onClose} className="h-9">Close</Button>
          <Button onClick={handleSave} disabled={saving} className="h-9 bg-blue-600 hover:bg-blue-700 text-white gap-2">
            {saving && <Save className="h-4 w-4 animate-pulse" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
