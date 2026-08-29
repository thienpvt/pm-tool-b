'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';

type Meeting = { id: number; name: string; frequency: string; content: string; participants: string; method: string; type: string; };
type Escalation = { id: number; level: number; level_name: string; channel: string; participants: string; input: string; output: string; };

export default function CommunicationPage() {
  const { id } = useParams<{ id: string }>();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [escalations, setEscalations] = useState<Escalation[]>([]);

  const load = useCallback(() => {
    fetch(`/api/projects/${id}/meetings`).then(r => r.json()).then(setMeetings);
    fetch(`/api/projects/${id}/escalations`).then(r => r.json()).then(setEscalations);
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const addMeeting = async () => {
    const res = await fetch(`/api/projects/${id}/meetings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'New Meeting', frequency: 'Weekly', method: 'Conf. Call' }) });
    res.json().then((row: Meeting) => setMeetings(m => [...m, row]));
  };

  const updateMeeting = (mid: number, field: string, value: string) => setMeetings(m => m.map(x => x.id === mid ? { ...x, [field]: value } : x));
  const saveMeeting = async (row: Meeting) => {
    await fetch(`/api/projects/${id}/meetings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) });
    toast.success('Saved');
  };
  const delMeeting = async (mid: number) => {
    await fetch(`/api/projects/${id}/meetings?rowId=${mid}`, { method: 'DELETE' });
    setMeetings(m => m.filter(x => x.id !== mid));
  };

  const updateEscalation = (eid: number, field: string, value: string) => setEscalations(e => e.map(x => x.id === eid ? { ...x, [field]: value } : x));
  const saveEscalation = async (row: Escalation) => {
    await fetch(`/api/projects/${id}/escalations`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row) });
    toast.success('Saved');
  };

  return (
    <>
        <h1 className="text-xl font-bold text-slate-800 mb-6">Communication Plan</h1>

        {/* Meetings */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-700">Regular Meetings</h2>
            <Button onClick={addMeeting} size="sm" className="bg-blue-600 hover:bg-blue-700 gap-2">
              <Plus className="h-4 w-4" /> Add Meeting
            </Button>
          </div>
          <div className="rounded-xl border bg-white overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[600px]">
              <thead>
                <tr className="bg-[#1e293b] text-white">
                  <th className="px-3 py-3 text-left w-48">Meeting Name</th>
                  <th className="px-3 py-3 text-left w-40">Frequency</th>
                  <th className="px-3 py-3 text-left w-56">Content / Agenda</th>
                  <th className="px-3 py-3 text-left w-56">Participants / PICs</th>
                  <th className="px-3 py-3 text-left w-32">Method</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody>
                {meetings.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">No meetings.</td></tr>}
                {meetings.map(row => (
                  <tr key={row.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2"><Input className="h-7 text-xs" value={row.name} onChange={e => updateMeeting(row.id, 'name', e.target.value)} onBlur={() => saveMeeting(row)} /></td>
                    <td className="px-3 py-2"><Input className="h-7 text-xs" value={row.frequency} onChange={e => updateMeeting(row.id, 'frequency', e.target.value)} onBlur={() => saveMeeting(row)} /></td>
                    <td className="px-3 py-2"><Textarea className="text-xs min-h-[56px] resize-y" value={row.content} onChange={e => updateMeeting(row.id, 'content', e.target.value)} onBlur={() => saveMeeting(row)} /></td>
                    <td className="px-3 py-2"><Textarea className="text-xs min-h-[56px] resize-y" value={row.participants} onChange={e => updateMeeting(row.id, 'participants', e.target.value)} onBlur={() => saveMeeting(row)} /></td>
                    <td className="px-3 py-2"><Input className="h-7 text-xs" value={row.method} onChange={e => updateMeeting(row.id, 'method', e.target.value)} onBlur={() => saveMeeting(row)} /></td>
                    <td className="px-3 py-2"><button onClick={() => delMeeting(row.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>

        {/* Escalation Path */}
        <div>
          <h2 className="font-semibold text-slate-700 mb-3">Escalation Path</h2>
          <div className="space-y-4">
            {escalations.map(esc => (
              <div key={esc.id} className={`rounded-xl border p-4 ${esc.level === 3 ? 'border-red-200 bg-red-50' : esc.level === 2 ? 'border-amber-200 bg-amber-50' : 'border-blue-200 bg-blue-50'}`}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${esc.level === 3 ? 'bg-red-200 text-red-800' : esc.level === 2 ? 'bg-amber-200 text-amber-800' : 'bg-blue-200 text-blue-800'}`}>
                    Level {esc.level}
                  </span>
                  <Input className="h-7 text-xs font-semibold flex-1 bg-white" value={esc.level_name} onChange={e => updateEscalation(esc.id, 'level_name', e.target.value)} onBlur={() => saveEscalation(esc)} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-slate-500 mb-1 font-medium">Channel / Cadence</p>
                    <Input className="h-7 text-xs bg-white" value={esc.channel} onChange={e => updateEscalation(esc.id, 'channel', e.target.value)} onBlur={() => saveEscalation(esc)} />
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1 font-medium">Participants</p>
                    <Textarea className="text-xs bg-white min-h-[56px]" value={esc.participants} onChange={e => updateEscalation(esc.id, 'participants', e.target.value)} onBlur={() => saveEscalation(esc)} />
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1 font-medium">Input</p>
                    <Input className="h-7 text-xs bg-white" value={esc.input} onChange={e => updateEscalation(esc.id, 'input', e.target.value)} onBlur={() => saveEscalation(esc)} />
                  </div>
                  <div>
                    <p className="text-slate-500 mb-1 font-medium">Output</p>
                    <Textarea className="text-xs bg-white min-h-[56px]" value={esc.output} onChange={e => updateEscalation(esc.id, 'output', e.target.value)} onBlur={() => saveEscalation(esc)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
    </>
  );
}
