'use client';
import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { ACTIVITY_FIELDS, SKIP } from './ActivityFields';
import type { EpicCorrection, FileData } from '../types';

export type PreviewRow = { resolved: Record<string, string>; raw: Record<string, string> };

export type ImportPreviewProps = {
  fileData: FileData;
  mapping: Record<string, string>;
  previewRows: PreviewRow[];
  jiraMode: boolean;
  epicMap: Record<string, string>;
  importRows: string[][];
  upsertStats: { newCount: number; overwriteCount: number };
  epicCorrectionsPreview: EpicCorrection[];
};

export function ImportPreview({
  fileData, mapping, previewRows, jiraMode, epicMap, importRows,
  upsertStats, epicCorrectionsPreview,
}: ImportPreviewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="text-xs text-slate-500 bg-slate-50 rounded px-3 py-2">
          Xem trước {Math.min(previewRows.length, 8)} dòng đầu · tổng <strong>{jiraMode ? importRows.length : fileData.allRows.length}</strong> dòng
          {jiraMode && <span className="ml-1 text-teal-600">· {Object.keys(epicMap).length} Epic được import như activity (tạo Phase group)</span>}
        </div>
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-300 shrink-0" />
          Giá trị được tự động chuẩn hoá (ngày, status…)
        </div>
      </div>

      {upsertStats.overwriteCount > 0 && (
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-4 py-2.5 text-xs text-orange-800">
          <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
          <div>
            <span className="font-semibold">{upsertStats.overwriteCount} dòng sẽ bị ghi đè</span>
            <span className="text-orange-600"> (Jira Key đã tồn tại) · </span>
            <span className="font-semibold text-green-700">{upsertStats.newCount} dòng mới</span>
          </div>
        </div>
      )}

      {upsertStats.overwriteCount === 0 && (upsertStats.newCount > 0) && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-4 py-2.5 text-xs text-green-800">
          <Check className="h-4 w-4 text-green-500 shrink-0" />
          <span className="font-semibold">{upsertStats.newCount} activity mới</span>
          <span className="text-green-600">· Không có key nào bị ghi đè</span>
        </div>
      )}

      {epicCorrectionsPreview.length > 0 && (
        <div className="flex flex-col gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 text-xs text-blue-800">
          <div className="flex items-center gap-2">
            <svg className="h-4 w-4 text-blue-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="font-semibold">Tự động sửa {epicCorrectionsPreview.length} Epic status</span>
            <span className="text-blue-600">· Status của children không khớp với Epic</span>
          </div>
          <div className="pl-6 space-y-0.5 max-h-28 overflow-y-auto">
            {epicCorrectionsPreview.map(c => (
              <div key={c.epicKey} className="flex items-center gap-1.5 flex-wrap">
                <span className="font-mono text-[10px] text-blue-500 shrink-0">[{c.epicKey}]</span>
                <span className="text-blue-700 max-w-[200px] truncate">{c.epicName}</span>
                <span className="text-blue-300">·</span>
                <span className="text-red-500 line-through">{c.oldStatus || 'To-do'}</span>
                <span className="text-blue-400">→</span>
                <span className={`font-semibold ${c.newStatus === 'Done' ? 'text-green-700' : 'text-amber-700'}`}>{c.newStatus}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-auto max-h-[55vh]">
        <table className="text-[11px] w-full">
          <thead className="bg-slate-50 border-b sticky top-0">
            <tr>
              {jiraMode && <th className="px-2 py-2 text-left font-semibold text-teal-600 whitespace-nowrap border-r">Phase (từ Epic)</th>}
              {ACTIVITY_FIELDS.filter(f => !f.virtual && mapping[f.key] && mapping[f.key] !== SKIP).map(f => (
                <th key={f.key} className="px-2 py-2 text-left font-semibold text-slate-600 whitespace-nowrap border-r last:border-r-0">
                  {f.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {previewRows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50">
                {jiraMode && (
                  <td className="px-2 py-1.5 border-r">
                    <div className="text-[11px] font-medium text-teal-700 max-w-[120px] truncate">{row.resolved['phase'] || '—'}</div>
                  </td>
                )}
                {ACTIVITY_FIELDS.filter(f => !f.virtual && mapping[f.key] && mapping[f.key] !== SKIP).map(f => {
                  const resolved = row.resolved[f.key] ?? '';
                  const rawVal   = row.raw[f.key] ?? '';
                  const wasConverted = rawVal && resolved && rawVal !== resolved;
                  return (
                    <td key={f.key} className={`px-2 py-1.5 max-w-[150px] border-r last:border-r-0 ${wasConverted ? 'bg-amber-50' : ''}`}>
                      <div className="truncate font-medium text-slate-800">{resolved || '—'}</div>
                      {wasConverted && (
                        <div className="truncate text-[10px] text-amber-600 mt-0.5" title={`Gốc: ${rawVal}`}>← {rawVal}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!mapping['activity'] || mapping['activity'] === SKIP ? (
        <div className="text-xs text-red-600 bg-red-50 rounded px-3 py-2">
          Chưa map cột Activity (bắt buộc). Quay lại bước 2 để mapping.
        </div>
      ) : null}
    </div>
  );
}
