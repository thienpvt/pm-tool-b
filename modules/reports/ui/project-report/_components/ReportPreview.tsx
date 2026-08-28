'use client';
import { BarChart2 } from 'lucide-react';

export type ReportPreviewProps = {
  previewRef: React.RefObject<HTMLDivElement | null>;
  hasReport: boolean;
  viewMode: 'preview' | 'source' | 'ai';
  report: string;
  activeView: string;
};

export function ReportPreview({ previewRef, hasReport, viewMode, report, activeView }: ReportPreviewProps) {
  return (
    <div className="flex-1 overflow-auto" ref={previewRef}>
      {!hasReport ? (
        <div className="h-full flex items-center justify-center text-slate-400">
          <div className="text-center max-w-sm">
            <BarChart2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="text-sm font-medium text-slate-500 mb-1">No report generated yet</p>
            <p className="text-xs text-slate-400">Select a period and click <strong>Generate Report</strong></p>
          </div>
        </div>
      ) : viewMode === 'source' ? (
        <pre className="p-6 text-xs font-mono text-slate-700 leading-relaxed whitespace-pre overflow-x-auto">{report}</pre>
      ) : (
        <div className="min-h-full bg-white">
          <div dangerouslySetInnerHTML={{ __html: activeView }} />
        </div>
      )}
    </div>
  );
}
