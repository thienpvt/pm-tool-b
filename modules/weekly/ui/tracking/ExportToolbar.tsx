'use client';

import { useState } from 'react';

export type ExportFormat = 'xlsx' | 'docx' | 'pptx';

type Props = {
  selectedIds: number[];
  exporting: boolean;
  onExport: (format: ExportFormat) => void;
};

export function ExportToolbar({ selectedIds, exporting, onExport }: Props) {
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const disabled = selectedIds.length === 0 || exporting;

  return (
    <div
      data-testid="export-toolbar"
      className="flex flex-wrap items-end gap-2 ml-auto"
    >
      <div className="space-y-1">
        <label htmlFor="export-format" className="text-xs font-semibold text-slate-600">
          Format
        </label>
        <select
          id="export-format"
          aria-label="Export format"
          className="h-8 text-sm border border-input rounded-md px-2 bg-white min-w-[100px]"
          value={format}
          disabled={exporting}
          onChange={(e) => setFormat(e.target.value as ExportFormat)}
        >
          <option value="xlsx">xlsx</option>
          <option value="docx">docx</option>
          <option value="pptx">pptx</option>
        </select>
      </div>
      <button
        type="button"
        className="h-8 px-3 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        disabled={disabled}
        onClick={() => onExport(format)}
      >
        {exporting ? 'Exporting…' : 'Export pack'}
      </button>
      {selectedIds.length === 0 && (
        <p className="text-xs text-muted-foreground w-full text-right">
          Select at least one project to export.
        </p>
      )}
    </div>
  );
}
