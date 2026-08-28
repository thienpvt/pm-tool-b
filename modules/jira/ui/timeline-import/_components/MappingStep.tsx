'use client';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Trash2, Check, FileSpreadsheet, Tag } from 'lucide-react';
import { ACTIVITY_FIELDS } from './ActivityFields';
import { TimelineFieldsPanel } from './MappingStepPanels';
import type { FileData, SavedMapping } from '../types';

export type MappingStepProps = {
  fileData: FileData;
  fileName: string;
  mapping: Record<string, string>;
  setFieldMapping: (field: string, col: string) => void;
  statusOverrides: Record<string, string>;
  setStatusOverrides: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  savedMappings: SavedMapping[];
  saveName: string;
  setSaveName: (n: string) => void;
  saving: boolean;
  onSaveTemplate: () => void;
  onApplyTemplate: (tpl: SavedMapping) => void;
  onDeleteTemplate: (id: number) => void;
  onAutoSuggest: () => void;
  jiraMode: boolean;
  epicMap: Record<string, string>;
  importRows: string[][];
  mappedCount: number;
  uniqueStatusValues: { raw: string; count: number; autoMapped: string }[];
};

export function MappingStep({
  fileData, fileName, mapping, setFieldMapping, statusOverrides, setStatusOverrides,
  savedMappings, saveName, setSaveName, saving, onSaveTemplate, onApplyTemplate, onDeleteTemplate, onAutoSuggest,
  jiraMode, epicMap, importRows, mappedCount, uniqueStatusValues,
}: MappingStepProps) {
  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-3 py-1.5 text-xs shrink-0">
          <FileSpreadsheet className="h-3.5 w-3.5 text-blue-500" />
          <span className="font-medium text-blue-700 max-w-[200px] truncate">{fileName}</span>
          <span className="text-blue-400">·</span>
          <span className="text-blue-600">{fileData.columns.length} cột</span>
          <span className="text-blue-400">·</span>
          <span className="text-blue-600">{fileData.allRows.length} dòng</span>
        </div>

        {jiraMode && (
          <div className="flex items-center gap-1 bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5 text-xs text-teal-700 shrink-0">
            <Tag className="h-3.5 w-3.5" />
            <span className="font-medium">Jira Mode:</span>
            <span>{Object.keys(epicMap).length} Epic (as activities) · {importRows.length - Object.keys(epicMap).length} Story/Task</span>
          </div>
        )}

        <div className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs shrink-0 border
          ${mappedCount > 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-slate-50 border-slate-200 text-slate-500'}`}>
          <Check className="h-3.5 w-3.5" />
          {mappedCount}/{ACTIVITY_FIELDS.filter(f => !f.virtual).length} trường đã map
        </div>

        <button
          className="text-xs text-blue-500 hover:text-blue-700 hover:underline px-2 py-1 shrink-0"
          onClick={onAutoSuggest}
          type="button"
        >
          Gợi ý tự động
        </button>

        <div className="flex-1" />

        {savedMappings.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] text-slate-400 shrink-0">Template:</span>
            {savedMappings.map(tpl => (
              <div key={tpl.id} className="flex items-center bg-white border border-slate-200 rounded-md overflow-hidden text-xs">
                <button type="button" className="px-2 py-1 text-blue-600 hover:bg-blue-50 font-medium" onClick={() => onApplyTemplate(tpl)}>{tpl.name}</button>
                <button type="button" onClick={() => onDeleteTemplate(tpl.id)} className="px-1.5 py-1 text-slate-300 hover:text-red-500 hover:bg-red-50 border-l border-slate-200"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <Input className="h-7 text-xs w-40" placeholder="Tên template..." value={saveName}
            onChange={e => setSaveName(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') onSaveTemplate(); }} />
          <Button size="sm" variant="outline" onClick={onSaveTemplate} disabled={saving || !saveName.trim()} className="gap-1 h-7 text-xs px-2">
            <Save className="h-3 w-3" />{saving ? '...' : 'Lưu'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
        <FileColumnsPanel fileData={fileData} mapping={mapping} />
        <TimelineFieldsPanel
          fileData={fileData}
          mapping={mapping}
          setFieldMapping={setFieldMapping}
          statusOverrides={statusOverrides}
          setStatusOverrides={setStatusOverrides}
          mappedCount={mappedCount}
          uniqueStatusValues={uniqueStatusValues}
        />
      </div>
    </div>
  );
}

function FileColumnsPanel({ fileData, mapping }: { fileData: FileData; mapping: Record<string, string> }) {
  return (
    <div className="flex flex-col border rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-semibold shrink-0">
        <FileSpreadsheet className="h-4 w-4" />
        <span>Cột trong file / text</span>
        <span className="ml-auto text-blue-200 text-xs font-normal">{fileData.columns.length} cột</span>
      </div>
      <div className="overflow-y-auto flex-1 divide-y divide-slate-100 bg-white">
        {fileData.columns.map((col, idx) => {
          const mappedField = Object.entries(mapping).find(([, v]) => v === col);
          const fieldDef = mappedField ? ACTIVITY_FIELDS.find(f => f.key === mappedField[0]) : null;
          const sampleVal = fileData.preview.find(r => r[idx]?.trim())?.[idx] ?? '';
          return (
            <div key={col} className={`flex items-start gap-3 px-3 py-2.5 transition-colors
              ${fieldDef ? 'bg-green-50 hover:bg-green-100/70' : 'hover:bg-slate-50'}`}>
              <span className="text-[11px] text-slate-400 w-5 text-right mt-0.5 shrink-0 font-mono">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold truncate ${fieldDef ? 'text-slate-800' : 'text-slate-600'}`}>{col}</p>
                {sampleVal && <p className="text-[11px] text-slate-400 truncate mt-0.5 italic">{sampleVal}</p>}
              </div>
              {fieldDef ? (
                <span className="shrink-0 text-[10px] bg-green-500 text-white px-1.5 py-0.5 rounded font-medium whitespace-nowrap">
                  → {fieldDef.label}
                </span>
              ) : (
                <span className="shrink-0 text-[10px] text-slate-300 px-1.5 py-0.5">—</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
