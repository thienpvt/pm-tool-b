'use client';
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ChevronRight, ChevronLeft, FileSpreadsheet, Check } from 'lucide-react';
import { autoSuggestMapping, SKIP } from './_components/ActivityFields';
import { parseCSVText } from './_components/CsvParser';
import {
  buildActivitiesForImport,
  computeEpicCorrectionsPreview,
  computeJiraDerived,
  computePreviewRows,
  computeUniqueStatusValues,
  computeUpsertStats,
  countMappedFields,
  getRowPhase,
} from './_components/importLogic';
import { ImportPreview } from './_components/ImportPreview';
import { MappingStep } from './_components/MappingStep';
import { UploadStep } from './_components/UploadStep';
import type { FileData, ImportStep, SavedMapping } from './types';
import { useImportMapping } from './useImportMapping';

export default function ImportMappingDialog({
  open, onOpenChange, projectId, onImported, projectPhase = '',
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  projectId: string;
  onImported: () => void;
  projectPhase?: string;
}) {
  const [step, setStep] = useState<ImportStep>(1);
  const [importSource, setImportSource] = useState<'file' | 'text'>('file');
  const [pastedText, setPastedText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [fileData, setFileData] = useState<FileData | null>(null);
  const [fileName, setFileName] = useState('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { savedMappings, setSavedMappings, existingJiraKeys } = useImportMapping({ open, projectId });

  const reset = useCallback(() => {
    setStep(1); setFileData(null); setFileName(''); setMapping({});
    setSaveName(''); setUploading(false); setImporting(false);
    setStatusOverrides({}); setPastedText(''); setImportSource('file');
  }, []);

  useEffect(() => { if (!open) reset(); }, [open, reset]);

  const textPreview = useMemo(() => {
    if (!pastedText.trim()) return null;
    return parseCSVText(pastedText);
  }, [pastedText]);

  const handleFileSelect = async (file: File) => {
    setUploading(true);
    setFileName(file.name);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/parse-file-headers', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('Parse failed');
      const data: FileData = await res.json();
      if (!data.columns?.length) { toast.error('Không tìm thấy header trong file'); return; }
      setFileData(data);
      setMapping(autoSuggestMapping(data.columns));
      setStep(2);
    } catch {
      toast.error('Không thể đọc file. Vui lòng kiểm tra định dạng.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleParseText = () => {
    if (!pastedText.trim()) { toast.error('Chưa có nội dung để phân tích'); return; }
    const data = parseCSVText(pastedText);
    if (!data.columns.length) { toast.error('Không tìm thấy cột nào trong nội dung'); return; }
    setFileName('(paste từ clipboard)');
    setFileData(data);
    setMapping(autoSuggestMapping(data.columns));
    setStep(2);
  };

  const setFieldMapping = (field: string, col: string) =>
    setMapping((m: Record<string, string>) => ({ ...m, [field]: col }));

  const applyTemplate = (tpl: SavedMapping) => {
    try {
      const parsed = JSON.parse(tpl.mappings_json) as Record<string, string>;
      const filtered: Record<string, string> = {};
      for (const [field, col] of Object.entries(parsed)) {
        if (fileData?.columns.includes(col)) filtered[field] = col;
      }
      setMapping(filtered);
      toast.success(`Đã áp dụng template "${tpl.name}"`);
    } catch { toast.error('Template không hợp lệ'); }
  };

  const saveTemplate = async () => {
    if (!saveName.trim()) { toast.error('Nhập tên template'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/import-mapping', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: saveName.trim(), mappings_json: mapping }),
      });
      const saved = await res.json();
      setSavedMappings((p: SavedMapping[]) => [saved, ...p]);
      setSaveName('');
      toast.success('Đã lưu template mapping');
    } catch { toast.error('Lưu thất bại'); }
    setSaving(false);
  };

  const deleteTemplate = async (id: number) => {
    await fetch(`/api/import-mapping/${id}`, { method: 'DELETE' });
    setSavedMappings((p: SavedMapping[]) => p.filter((m: SavedMapping) => m.id !== id));
    toast.success('Đã xóa template');
  };

  const { jiraMode, epicMap, epicPhaseMap, importRows } = useMemo(
    () => computeJiraDerived(fileData, mapping, projectPhase),
    [fileData, mapping, projectPhase],
  );

  const getRowPhaseFn = useCallback(
    (row: string[]) => fileData ? getRowPhase(row, fileData, jiraMode, mapping, epicPhaseMap, projectPhase) : 'General',
    [fileData, jiraMode, mapping, epicPhaseMap, projectPhase],
  );

  const uniqueStatusValues = useMemo(
    () => computeUniqueStatusValues(fileData, mapping),
    [fileData, mapping],
  );

  const previewRows = useMemo(
    () => computePreviewRows(fileData, importRows, jiraMode, mapping, statusOverrides, getRowPhaseFn),
    [fileData, importRows, jiraMode, mapping, statusOverrides, getRowPhaseFn],
  );

  const epicCorrectionsPreview = useMemo(
    () => computeEpicCorrectionsPreview(fileData, jiraMode, importRows, mapping, statusOverrides),
    [fileData, jiraMode, importRows, mapping, statusOverrides],
  );

  const upsertStats = useMemo(
    () => computeUpsertStats(fileData, importRows, jiraMode, mapping, existingJiraKeys),
    [fileData, importRows, jiraMode, mapping, existingJiraKeys],
  );

  const handleImport = async () => {
    if (!fileData) return;
    const activityCol = mapping['activity'];
    if (!activityCol || activityCol === SKIP) {
      toast.error('Vui lòng map cột Activity');
      return;
    }

    setImporting(true);
    const rows = jiraMode ? importRows : fileData.allRows;
    const activities = buildActivitiesForImport(
      fileData, rows, jiraMode, mapping, statusOverrides, getRowPhaseFn,
    );

    try {
      const res = await fetch(`/api/projects/${projectId}/activities/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities }),
      });
      const result = await res.json();
      if (result.errors?.length) {
        toast.error(`Import xong với ${result.errors.length} lỗi`);
      } else {
        const parts = [];
        if (result.inserted > 0) parts.push(`${result.inserted} mới`);
        if (result.updated > 0) parts.push(`${result.updated} cập nhật`);
        toast.success(`Import thành công: ${parts.join(', ')}`);
      }
    } catch {
      toast.error('Import thất bại');
    }

    setImporting(false);
    onImported();
    onOpenChange(false);
  };

  const mappedCount = countMappedFields(mapping);

  return (
    <Dialog open={open} onOpenChange={(o: boolean) => { if (!o) onOpenChange(false); }}>
      <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-[98vw] h-[94vh] overflow-hidden flex flex-col p-5">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-blue-600" />
            Import Activities
            <span className="ml-auto text-xs font-normal text-slate-400">
              Bước {step} / 3
            </span>
          </DialogTitle>
          <div className="flex items-center gap-1 pt-1">
            {(['Upload / Paste', 'Map cột', 'Xem trước & Import'] as const).map((label, i) => (
              <React.Fragment key={i}>
                <div className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
                  ${step === i + 1 ? 'bg-blue-600 text-white' : step > i + 1 ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-400'}`}>
                  {step > i + 1 ? <Check className="h-3 w-3" /> : <span>{i + 1}</span>}
                  {label}
                </div>
                {i < 2 && <ChevronRight className="h-3 w-3 text-slate-300" />}
              </React.Fragment>
            ))}
          </div>
        </DialogHeader>

        <div className={`flex-1 py-2 ${step === 2 ? 'overflow-hidden flex flex-col' : 'overflow-y-auto'}`}>
          {step === 1 && (
            <UploadStep
              importSource={importSource}
              setImportSource={setImportSource}
              pastedText={pastedText}
              setPastedText={setPastedText}
              textPreview={textPreview}
              uploading={uploading}
              fileInputRef={fileInputRef}
              onFileSelect={handleFileSelect}
              onDrop={handleDrop}
            />
          )}
          {step === 2 && fileData && (
            <MappingStep
              fileData={fileData}
              fileName={fileName}
              mapping={mapping}
              setFieldMapping={setFieldMapping}
              statusOverrides={statusOverrides}
              setStatusOverrides={setStatusOverrides}
              savedMappings={savedMappings}
              saveName={saveName}
              setSaveName={setSaveName}
              saving={saving}
              onSaveTemplate={saveTemplate}
              onApplyTemplate={applyTemplate}
              onDeleteTemplate={deleteTemplate}
              onAutoSuggest={() => setMapping(autoSuggestMapping(fileData.columns))}
              jiraMode={jiraMode}
              epicMap={epicMap}
              importRows={importRows}
              mappedCount={mappedCount}
              uniqueStatusValues={uniqueStatusValues}
            />
          )}
          {step === 3 && fileData && (
            <ImportPreview
              fileData={fileData}
              mapping={mapping}
              previewRows={previewRows}
              jiraMode={jiraMode}
              epicMap={epicMap}
              importRows={importRows}
              upsertStats={upsertStats}
              epicCorrectionsPreview={epicCorrectionsPreview}
            />
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="outline" onClick={() => { if (step === 1) onOpenChange(false); else setStep(s => (s - 1) as ImportStep); }}>
            {step === 1 ? 'Hủy' : <><ChevronLeft className="h-4 w-4 mr-1" />Quay lại</>}
          </Button>
          <div className="flex-1" />
          {step === 1 && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              disabled={importSource === 'file' ? !fileData : !textPreview?.columns.length}
              onClick={() => {
                if (importSource === 'text') handleParseText();
                else setStep(2);
              }}
            >
              Tiếp theo <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 2 && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setStep(3)}>
              Xem trước <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          )}
          {step === 3 && (
            <Button
              className="bg-green-600 hover:bg-green-700"
              disabled={importing || !mapping['activity'] || mapping['activity'] === SKIP}
              onClick={handleImport}
            >
              {importing ? 'Đang import...' : `Import ${upsertStats.newCount + upsertStats.overwriteCount} dòng`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
