'use client';
import React from 'react';
import { Upload, ClipboardPaste } from 'lucide-react';
import type { FileData } from '../types';

export type UploadStepProps = {
  importSource: 'file' | 'text';
  setImportSource: (s: 'file' | 'text') => void;
  pastedText: string;
  setPastedText: (t: string) => void;
  textPreview: FileData | null;
  uploading: boolean;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onFileSelect: (file: File) => void;
  onDrop: (e: React.DragEvent) => void;
};

export function UploadStep({
  importSource, setImportSource, pastedText, setPastedText, textPreview,
  uploading, fileInputRef, onFileSelect, onDrop,
}: UploadStepProps) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex gap-1 bg-slate-100 border border-slate-200 rounded-lg p-0.5 w-fit">
        <button
          onClick={() => setImportSource('file')}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
            importSource === 'file' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <Upload className="h-3.5 w-3.5" /> Upload file
        </button>
        <button
          onClick={() => setImportSource('text')}
          className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
            importSource === 'text' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <ClipboardPaste className="h-3.5 w-3.5" /> Paste text
        </button>
      </div>

      {importSource === 'file' && (
        <div className="space-y-4">
          <div
            className="border-2 border-dashed border-slate-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/40 transition-colors"
            onClick={() => fileInputRef.current?.click()}
            onDrop={onDrop}
            onDragOver={e => e.preventDefault()}
          >
            <Upload className="h-10 w-10 mx-auto text-slate-300 mb-3" />
            <p className="font-medium text-slate-600">Kéo thả hoặc click để chọn file</p>
            <p className="text-xs text-slate-400 mt-1">Hỗ trợ: .xlsx, .xls, .csv, .txt</p>
          </div>
          <input
            ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv,.txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) onFileSelect(f); e.target.value = ''; }}
          />
          {uploading && <div className="text-center text-sm text-blue-600 animate-pulse">Đang đọc file...</div>}
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500 space-y-1">
            <p className="font-medium text-slate-600">Lưu ý:</p>
            <p>• Hệ thống tự động tìm dòng header — bỏ qua các dòng trống ở đầu file</p>
            <p>• Hỗ trợ mọi cấu trúc file: tên cột bất kỳ, thứ tự tuỳ ý</p>
            <p>• Bước tiếp theo bạn chỉ cần kéo thả / chọn dropdown để map từng cột</p>
          </div>
        </div>
      )}

      {importSource === 'text' && (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Paste nội dung CSV từ Jira hoặc bất kỳ công cụ nào vào ô bên dưới</span>
            {textPreview && textPreview.columns.length > 0 && (
              <span className="text-xs font-medium text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full ml-auto">
                ✓ {textPreview.columns.length} cột · {textPreview.allRows.length} dòng
              </span>
            )}
          </div>
          <textarea
            className="flex-1 font-mono text-xs border border-slate-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none bg-slate-50"
            placeholder={`Paste CSV ở đây. Ví dụ Jira:\n"Key","Issue Type","Parent","Summary","Status","Assignee","Sprint","Start date","Due date"\n"PROJ-1","Epic","","Tên Epic","New","Nguyen Van A","","2026/01/01","2026/03/31"\n"PROJ-2","Story","PROJ-1","Tên Story","In Progress","","Sprint 1","2026/01/01","2026/01/31"`}
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
          />

          {textPreview && textPreview.columns.length > 0 && (
            <div className="border border-slate-200 rounded-lg overflow-auto max-h-36 bg-white">
              <table className="text-[10px] w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    {textPreview.columns.slice(0, 8).map((col, i) => (
                      <th key={i} className="px-2 py-1.5 text-left font-semibold text-slate-600 border-r last:border-r-0 whitespace-nowrap">{col}</th>
                    ))}
                    {textPreview.columns.length > 8 && <th className="px-2 py-1.5 text-slate-400">+{textPreview.columns.length - 8} cột</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {textPreview.preview.slice(0, 3).map((row, ri) => (
                    <tr key={ri}>
                      {textPreview.columns.slice(0, 8).map((_, ci) => (
                        <td key={ci} className="px-2 py-1 border-r last:border-r-0 max-w-[120px] truncate text-slate-600">{row[ci] ?? ''}</td>
                      ))}
                      {textPreview.columns.length > 8 && <td className="px-2 py-1 text-slate-300">…</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="bg-teal-50 border border-teal-100 rounded-lg p-3 text-xs text-teal-700 space-y-1">
            <p className="font-semibold">Hỗ trợ cấu trúc Jira:</p>
            <p>• Dòng <strong>Epic</strong> → tạo <strong>Phase group</strong> VÀ được import như activity (hiển thị đầy đủ Key, Status, ngày tháng)</p>
            <p>• Dòng <strong>Story/Task</strong> có Parent → trở thành <strong>Activity</strong> thuộc Phase tương ứng</p>
            <p>• Map cột <em>Issue Type</em> và <em>Parent</em> ở bước 2 để bật chế độ này</p>
          </div>
        </div>
      )}
    </div>
  );
}
