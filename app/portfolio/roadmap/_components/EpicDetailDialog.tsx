'use client';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { weightedProgress, statusPct } from '@/lib/status-weights';
import type { EpicDetailData } from '../types';
import { statusColor } from './EpicColours';
import { fmt } from './helpers';

export type EpicDetailDialogProps = {
  epicDetail: EpicDetailData | null;
  onClose: () => void;
};

export function EpicDetailDialog({ epicDetail, onClose }: EpicDetailDialogProps) {
  return (
    <Dialog open={!!epicDetail} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        {epicDetail && (() => {
          const childTotal = weightedProgress(epicDetail.children.map(c => c.status));
          return (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 flex-wrap pr-6">
                  <span className="text-xs font-semibold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">EPIC</span>
                  {epicDetail.jira_key && (
                    <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{epicDetail.jira_key}</span>
                  )}
                  <span className="text-base font-bold text-slate-800">{epicDetail.epicActivity}</span>
                </DialogTitle>
              </DialogHeader>

              <p className="text-xs text-slate-500 -mt-1">
                {epicDetail.projectName}
                <span className="mx-2 text-slate-300">|</span>
                <Badge className={`text-xs px-1.5 py-0 ${statusColor(epicDetail.status)}`}>{epicDetail.status}</Badge>
              </p>

              <div className="bg-slate-50 rounded-lg border p-3 flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-600 shrink-0">Tiến độ tổng ({epicDetail.children.length} child)</span>
                <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                  <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${childTotal}%` }} />
                </div>
                <span className="text-lg font-bold text-orange-600 tabular-nums shrink-0">{childTotal}%</span>
              </div>
              <p className="text-[11px] text-slate-400 -mt-1">Tính theo tỷ trọng (weighted) trạng thái của toàn bộ child.</p>

              <div className="overflow-auto flex-1 -mx-1 px-1">
                {epicDetail.children.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-8">Epic này chưa có child nào.</p>
                ) : (
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b">
                        <th className="py-2 px-2">Key / No</th>
                        <th className="py-2 px-2">Activity</th>
                        <th className="py-2 px-2">Trạng thái</th>
                        <th className="py-2 px-2 text-right">%</th>
                        <th className="py-2 px-2">Bắt đầu</th>
                        <th className="py-2 px-2">Kết thúc</th>
                      </tr>
                    </thead>
                    <tbody>
                      {epicDetail.children.map(c => (
                        <tr key={c.id} className="border-b last:border-b-0 hover:bg-slate-50">
                          <td className="py-2 px-2 whitespace-nowrap">
                            {c.jira_key
                              ? <span className="text-xs font-mono bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{c.jira_key}</span>
                              : <span className="text-xs text-slate-400">{c.no || '—'}</span>}
                          </td>
                          <td className="py-2 px-2 text-slate-700">{c.activity}</td>
                          <td className="py-2 px-2"><Badge className={`text-xs px-1.5 py-0 ${statusColor(c.status)}`}>{c.status}</Badge></td>
                          <td className="py-2 px-2 text-right tabular-nums text-slate-600">{statusPct(c.status)}%</td>
                          <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{fmt(c.plan_start)}</td>
                          <td className="py-2 px-2 text-slate-500 whitespace-nowrap">{fmt(c.plan_end)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
