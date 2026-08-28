'use client';
import React from 'react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Check, BarChart2 } from 'lucide-react';
import {
  ACTIVITY_FIELDS, FIELD_GROUPS, SKIP, STATUSES,
} from './ActivityFields';
import { resolveField } from './ValueNormalizers';
import type { FileData } from '../types';

export function TimelineFieldsPanel({
  fileData, mapping, setFieldMapping, statusOverrides, setStatusOverrides,
  mappedCount, uniqueStatusValues,
}: {
  fileData: FileData;
  mapping: Record<string, string>;
  setFieldMapping: (field: string, col: string) => void;
  statusOverrides: Record<string, string>;
  setStatusOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  mappedCount: number;
  uniqueStatusValues: { raw: string; count: number; autoMapped: string }[];
}) {
  const headerColor: Record<string, string> = {
    blue: 'text-blue-700 bg-blue-50 border-blue-100',
    purple: 'text-purple-700 bg-purple-50 border-purple-100',
    orange: 'text-orange-700 bg-orange-50 border-orange-100',
    green: 'text-green-700 bg-green-50 border-green-100',
    red: 'text-red-700 bg-red-50 border-red-100',
    gray: 'text-slate-500 bg-slate-50 border-slate-100',
    teal: 'text-teal-700 bg-teal-50 border-teal-100',
  };
  const dotDefault: Record<string, string> = {
    blue: 'bg-blue-300', purple: 'bg-purple-300', orange: 'bg-orange-300',
    green: 'bg-green-300', red: 'bg-red-300', gray: 'bg-slate-200', teal: 'bg-teal-300',
  };

  return (
    <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 text-white text-sm font-semibold shrink-0">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        <span>Trường trong Timeline</span>
        <span className="ml-auto text-slate-400 text-xs font-normal">{mappedCount}/{ACTIVITY_FIELDS.filter(f => !f.virtual).length} đã map</span>
      </div>
      <div className="overflow-y-auto flex-1 bg-white">
        {FIELD_GROUPS.map(group => {
          const groupFields = ACTIVITY_FIELDS.filter(f => group.keys.includes(f.key));
          const nonVirtualFields = groupFields.filter(f => !f.virtual);
          const mappedInGroup = nonVirtualFields.filter(f => mapping[f.key] && mapping[f.key] !== SKIP).length;
          const jiraVirtualMapped = groupFields.filter(f => f.virtual && mapping[f.key] && mapping[f.key] !== SKIP).length;
          const GroupIcon = group.icon;

          return (
            <div key={group.label}>
              <div className={`sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 border-b border-t ${headerColor[group.color]}`}>
                <GroupIcon className="h-3 w-3 shrink-0" />
                <span className="text-[11px] font-semibold uppercase tracking-wide flex-1">{group.label}</span>
                {group.color === 'teal' && jiraVirtualMapped > 0 && (
                  <span className="text-[10px] bg-teal-500 text-white px-1.5 py-0.5 rounded-full">Jira Mode</span>
                )}
                {nonVirtualFields.length > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold
                    ${mappedInGroup === nonVirtualFields.length
                      ? 'bg-green-500 text-white'
                      : mappedInGroup > 0 ? 'bg-white/80 text-current' : 'bg-white/60 text-current opacity-60'}`}>
                    {mappedInGroup}/{nonVirtualFields.length}
                  </span>
                )}
              </div>

              {groupFields.map(field => (
                <FieldMappingRow
                  key={field.key}
                  field={field}
                  fileData={fileData}
                  mapping={mapping}
                  setFieldMapping={setFieldMapping}
                  statusOverrides={statusOverrides}
                  dotDefault={dotDefault[group.color]}
                />
              ))}
            </div>
          );
        })}

        {uniqueStatusValues.length > 0 && (
          <StatusValueMapping
            uniqueStatusValues={uniqueStatusValues}
            statusOverrides={statusOverrides}
            setStatusOverrides={setStatusOverrides}
          />
        )}
      </div>
    </div>
  );
}

function FieldMappingRow({
  field, fileData, mapping, setFieldMapping, statusOverrides, dotDefault,
}: {
  field: { key: string; label: string; required?: boolean; virtual?: boolean };
  fileData: FileData;
  mapping: Record<string, string>;
  setFieldMapping: (field: string, col: string) => void;
  statusOverrides: Record<string, string>;
  dotDefault: string;
}) {
  const isMapped = !!(mapping[field.key] && mapping[field.key] !== SKIP);
  const isRequiredUnmapped = field.required && !isMapped;
  const mappedCol = isMapped ? mapping[field.key] : null;
  const colIdx = mappedCol != null ? fileData.columns.indexOf(mappedCol) : -1;
  const sampleRaw = colIdx >= 0
    ? (fileData.preview.find((r: string[]) => r[colIdx]?.trim())?.[colIdx] ?? '')
    : '';
  const sampleResolved = sampleRaw && !field.virtual ? resolveField(field.key, sampleRaw, statusOverrides) : sampleRaw;
  const wasConverted = !!(sampleRaw && sampleResolved && sampleRaw !== sampleResolved);

  return (
    <div className={`px-3 py-2 border-b last:border-b-0 transition-colors
      ${field.virtual ? 'bg-teal-50/30' : ''}
      ${isMapped ? (field.virtual ? 'bg-teal-50' : 'bg-green-50/40') : isRequiredUnmapped ? 'bg-red-50/30' : 'hover:bg-slate-50/60'}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <div className={`w-1.5 h-1.5 rounded-full shrink-0
          ${isMapped ? (field.virtual ? 'bg-teal-500' : 'bg-green-500') : isRequiredUnmapped ? 'bg-red-400' : dotDefault}`} />
        <span className={`text-[11px] leading-tight flex-1
          ${field.required ? 'font-semibold text-slate-800' : field.virtual ? 'text-teal-700' : 'text-slate-500'}`}>
          {field.label}
          {field.required && <span className="text-red-500 ml-0.5">*</span>}
          {field.virtual && <span className="ml-1 text-[9px] bg-teal-100 text-teal-600 px-1 rounded">Jira</span>}
        </span>
        {isMapped && <Check className={`h-3 w-3 shrink-0 ${field.virtual ? 'text-teal-500' : 'text-green-500'}`} />}
      </div>

      <Select
        value={mapping[field.key] ?? SKIP}
        onValueChange={(val: string | null) => setFieldMapping(field.key, val ?? SKIP)}
      >
        <SelectTrigger className={`h-7 text-xs w-full
          ${isMapped
            ? field.virtual ? 'border-teal-300 bg-white text-teal-800 font-medium' : 'border-green-300 bg-white text-green-800 font-medium'
            : isRequiredUnmapped ? 'border-red-200 text-slate-400' : 'text-slate-400'}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={SKIP}>— Bỏ qua —</SelectItem>
          {fileData.columns.map((col: string) => {
            const ci = fileData.columns.indexOf(col);
            const s = fileData.preview.find((r: string[]) => r[ci]?.trim())?.[ci] ?? '';
            return (
              <SelectItem key={col} value={col}>
                {col}{s ? ` · ${s.length > 20 ? s.substring(0, 20) + '…' : s}` : ''}
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>

      {isMapped && !field.virtual && (
        <div className="mt-1 px-1">
          {sampleRaw ? (
            wasConverted ? (
              <div className="flex items-center gap-1 text-[10px] text-amber-600">
                <span className="line-through opacity-60 truncate max-w-[40%]">{sampleRaw}</span>
                <span className="shrink-0">→</span>
                <span className="font-medium truncate">{sampleResolved}</span>
              </div>
            ) : (
              <div className="text-[10px] text-slate-400 italic truncate">{sampleResolved || sampleRaw}</div>
            )
          ) : (
            <div className="text-[10px] text-slate-300 italic">không có dữ liệu mẫu</div>
          )}
        </div>
      )}
    </div>
  );
}

function StatusValueMapping({
  uniqueStatusValues, statusOverrides, setStatusOverrides,
}: {
  uniqueStatusValues: { raw: string; count: number; autoMapped: string }[];
  statusOverrides: Record<string, string>;
  setStatusOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
}) {
  return (
    <div className="border-t-2 border-green-200 mt-1">
      <div className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-green-50 border-b border-green-100">
        <BarChart2 className="h-3 w-3 text-green-600 shrink-0" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-green-700 flex-1">
          Mapping giá trị Status
        </span>
        <span className="text-[10px] text-green-600">{uniqueStatusValues.length} giá trị</span>
      </div>
      <div className="divide-y divide-slate-100">
        {uniqueStatusValues.map(({ raw, count, autoMapped }) => {
          const override = statusOverrides[raw] ?? '';
          const isExact = STATUSES.includes(raw);
          return (
            <div key={raw} className="px-3 py-2 flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className={`text-xs font-mono truncate ${isExact ? 'text-green-700' : 'text-slate-600'}`}>{raw}</span>
                  <span className="text-[10px] text-slate-300">×{count}</span>
                </div>
              </div>
              <span className="text-slate-300 text-xs">→</span>
              <Select
                value={override || autoMapped}
                onValueChange={(val: string | null) => {
                  const v = val ?? autoMapped;
                  if (v === autoMapped) {
                    setStatusOverrides(prev => { const n = { ...prev }; delete n[raw]; return n; });
                  } else {
                    setStatusOverrides(prev => ({ ...prev, [raw]: v }));
                  }
                }}
              >
                <SelectTrigger className={`h-6 text-xs w-36 ${override ? 'border-amber-300 text-amber-700' : 'border-green-200 text-green-700'}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectGroup>
                    <SelectLabel className="text-[10px] text-slate-400 py-1">Chưa làm</SelectLabel>
                    {['New', 'To Do', 'To-do', 'REFINEMENT'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="text-[10px] text-slate-400 py-1">Đang làm</SelectLabel>
                    {['In Dev', 'In development', 'Ready For Dev', 'In Progress'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="text-[10px] text-slate-400 py-1">Giữa chừng</SelectLabel>
                    {['In Review', 'PENDING'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="text-[10px] text-slate-400 py-1">Đang test</SelectLabel>
                    {['In Testing', 'Testing', 'Ready for Test', 'READY4TEST', 'STAGING-READY4TEST'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="text-[10px] text-slate-400 py-1">Gần xong</SelectLabel>
                    {['Re-Open'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="text-[10px] text-slate-400 py-1">Hoàn thành</SelectLabel>
                    {['Done', 'UAT', 'Deployed', 'QC Done', 'READY TO RELEASE', 'READY FOR RELEASE', 'Passed QC', 'ANBM'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectGroup>
                  <SelectSeparator />
                  <SelectGroup>
                    <SelectLabel className="text-[10px] text-slate-400 py-1">Đặc biệt</SelectLabel>
                    {['Blocked', 'Deferred'].map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectGroup>
                </SelectContent>
              </Select>
              {!override && !isExact && (
                <span className="text-[9px] text-amber-500 shrink-0">auto</span>
              )}
              {override && (
                <button type="button" className="text-[9px] text-slate-400 hover:text-red-500 shrink-0"
                  onClick={() => setStatusOverrides(prev => { const n = { ...prev }; delete n[raw]; return n; })}>
                  reset
                </button>
              )}
              {isExact && <Check className="h-3 w-3 text-green-500 shrink-0" />}
            </div>
          );
        })}
      </div>
      <div className="px-3 py-2 text-[10px] text-slate-400 italic bg-slate-50">
        Thay đổi mapping nếu muốn — mặc định dựa trên nhận dạng tự động
      </div>
    </div>
  );
}
