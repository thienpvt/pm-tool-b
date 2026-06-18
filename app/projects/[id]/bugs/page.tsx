'use client';
import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Upload, Bug, Clock, RefreshCw, ChevronLeft, ChevronRight,
  FlaskConical, Sparkles, Calendar, Trash2, History, Download,
} from 'lucide-react';
import BugImportDialog from '@/components/bugs/BugImportDialog';
import JiraSyncDialog from '@/components/jira/JiraSyncDialog';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────
type BugRecord = {
  id: number;
  issue_type: string;
  issue_key: string;
  issue_id: string;
  summary: string;
  assignee: string;
  reporter: string;
  priority: string;
  severity: string;
  status: string;
  resolution: string;
  created: string;
  snapshot_date: string;
};
type SnapshotDate = { snapshot_date: string; count: number };

// ─── Constants ────────────────────────────────────────────────────────────────
const ACTIVE_STATUSES = ['To Do', 'In Progress', 'Reopen'];
const PRIORITY_COLORS: Record<string, string> = {
  Critical: '#ef4444', Major: '#f97316', Medium: '#eab308', Minor: '#22c55e',
};
const STATUS_COLORS: Record<string, string> = {
  'To Do': '#94a3b8', 'In Progress': '#3b82f6', 'Reopen': '#f97316',
  'Ready for Test': '#8b5cf6', 'Done': '#22c55e', 'Resolved': '#10b981',
  'Blocked': '#ef4444', "Won't Fix": '#6b7280', 'Duplicate': '#9ca3af',
};
const PRIORITY_BADGE: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 border-red-200',
  Major:    'bg-orange-100 text-orange-700 border-orange-200',
  Medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  Minor:    'bg-green-100 text-green-700 border-green-200',
};
const SEVERITY_COLORS: Record<string, string> = {
  Critical: '#dc2626', High: '#f97316', Medium: '#eab308', Low: '#22c55e',
};
const SEVERITY_BADGE: Record<string, string> = {
  Critical: 'bg-red-100 text-red-700 border-red-200',
  High:     'bg-orange-100 text-orange-700 border-orange-200',
  Medium:   'bg-yellow-100 text-yellow-700 border-yellow-200',
  Low:      'bg-green-100 text-green-700 border-green-200',
};
const STATUS_BADGE: Record<string, string> = {
  'To Do':          'bg-slate-100 text-slate-600',
  'In Progress':    'bg-blue-100 text-blue-700',
  'Reopen':         'bg-orange-100 text-orange-700',
  'Ready for Test': 'bg-purple-100 text-purple-700',
  'Done':           'bg-green-100 text-green-700',
  'Resolved':       'bg-emerald-100 text-emerald-700',
  'Blocked':        'bg-red-100 text-red-700',
  "Won't Fix":      'bg-gray-100 text-gray-600',
  'Duplicate':      'bg-gray-100 text-gray-500',
};
const PAGE_SIZE = 50;

// ─── Custom Pie label ─────────────────────────────────────────────────────────
function renderCustomLabel({ cx, cy, midAngle, innerRadius, outerRadius, percent }: {
  cx?: number; cy?: number; midAngle?: number; innerRadius?: number; outerRadius?: number; percent?: number;
}) {
  if ((percent ?? 0) < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const radius = (innerRadius ?? 0) + ((outerRadius ?? 0) - (innerRadius ?? 0)) * 0.55;
  const x = (cx ?? 0) + radius * Math.cos(-(midAngle ?? 0) * RADIAN);
  const y = (cy ?? 0) + radius * Math.sin(-(midAngle ?? 0) * RADIAN);
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="600">
      {`${Math.round((percent ?? 0) * 100)}%`}
    </text>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function BugsPage() {
  const { id } = useParams<{ id: string }>();
  const [bugs, setBugs] = useState<BugRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'summary' | 'list'>('summary');
  const [importOpen, setImportOpen] = useState(false);
  const [jiraSyncOpen, setJiraSyncOpen] = useState(false);
  const [projectName, setProjectName] = useState('');

  // Snapshot dates
  const [snapshotDates, setSnapshotDates] = useState<SnapshotDate[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [deletingDate, setDeletingDate] = useState(false);

  // Bug Leaders
  const [bugThreshold, setBugThreshold] = useState(5);

  // List filters
  const [filterStatus, setFilterStatus] = useState('__all__');
  const [filterPriority, setFilterPriority] = useState('__all__');
  const [filterSeverity, setFilterSeverity] = useState('__all__');
  const [page, setPage] = useState(1);
  const [exportingPdf, setExportingPdf] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const today = new Date().toISOString().split('T')[0];

  const fetchDates = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/bugs?list_dates=1`);
      if (!res.ok) return;
      const dates: SnapshotDate[] = await res.json();
      setSnapshotDates(dates);
      return dates;
    } catch { return undefined; }
  }, [id]);

  const fetchBugs = useCallback(async (date?: string) => {
    setLoading(true);
    try {
      const url = date
        ? `/api/projects/${id}/bugs?date=${date}`
        : `/api/projects/${id}/bugs`;
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      setBugs(await res.json());
    } catch { toast.error('Không thể tải danh sách bug'); }
    setLoading(false);
  }, [id]);

  // On mount: fetch project name + dates + bugs
  useEffect(() => {
    fetch(`/api/projects/${id}`).then(r => r.ok ? r.json() : null).then(p => {
      if (p?.name) setProjectName(p.name);
    });
    (async () => {
      const dates = await fetchDates();
      if (dates && dates.length > 0) {
        setSelectedDate(dates[0].snapshot_date);
        await fetchBugs(dates[0].snapshot_date);
      } else {
        await fetchBugs();
      }
    })();
  }, [id]);

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    fetchBugs(date);
    setPage(1);
  };

  const handleAfterImport = async () => {
    const dates = await fetchDates();
    if (dates && dates.length > 0) {
      // Select the most recent date (which is the one just imported)
      setSelectedDate(dates[0].snapshot_date);
      await fetchBugs(dates[0].snapshot_date);
    } else {
      await fetchBugs();
    }
  };

  const handleDeleteSnapshot = async () => {
    if (!selectedDate) return;
    if (!confirm(`Xóa toàn bộ bug của ngày ${selectedDate}?`)) return;
    setDeletingDate(true);
    try {
      await fetch(`/api/projects/${id}/bugs?date=${selectedDate}`, { method: 'DELETE' });
      toast.success(`Đã xóa snapshot ngày ${selectedDate}`);
      const dates = await fetchDates();
      if (dates && dates.length > 0) {
        setSelectedDate(dates[0].snapshot_date);
        await fetchBugs(dates[0].snapshot_date);
      } else {
        setSelectedDate('');
        setBugs([]);
        setLoading(false);
      }
    } catch { toast.error('Xóa thất bại'); }
    setDeletingDate(false);
  };

  // ── Summary computations ───────────────────────────────────────────────────
  const activeCount = useMemo(
    () => ACTIVE_STATUSES.reduce((acc, s) => ({ ...acc, [s]: bugs.filter(b => b.status === s).length }), {} as Record<string, number>),
    [bugs],
  );
  const activeTotal = ACTIVE_STATUSES.reduce((sum, s) => sum + (activeCount[s] ?? 0), 0);

  const priorityData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bugs) { const p = b.priority || 'Medium'; counts[p] = (counts[p] ?? 0) + 1; }
    const order = ['Critical', 'Major', 'Medium', 'Minor'];
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => (order.indexOf(a.name) ?? 99) - (order.indexOf(b.name) ?? 99));
  }, [bugs]);

  const severityData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bugs) {
      if (b.severity) counts[b.severity] = (counts[b.severity] ?? 0) + 1;
    }
    const order = ['Critical', 'High', 'Medium', 'Low'];
    return Object.entries(counts).map(([name, value]) => ({ name, value }))
      .sort((a, b) => (order.indexOf(a.name) ?? 99) - (order.indexOf(b.name) ?? 99));
  }, [bugs]);

  const statusChartData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const b of bugs) {
      const s = b.status || 'To Do';
      if (ACTIVE_STATUSES.includes(s)) counts[s] = (counts[s] ?? 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [bugs]);

  const readyForTestCount = useMemo(() => bugs.filter(b => b.status === 'Ready for Test').length, [bugs]);
  const newTodayCount = useMemo(
    () => bugs.filter(b => b.created?.substring(0, 10) === today).length,
    [bugs, today],
  );

  // ── Assignee stats (Bug Leaders) ───────────────────────────────────────────
  const assigneeStats = useMemo(() => {
    const map: Record<string, { total: number; active: number; critical: number }> = {};
    for (const b of bugs) {
      const name = b.assignee?.trim() || 'Unassigned';
      if (!map[name]) map[name] = { total: 0, active: 0, critical: 0 };
      map[name].total++;
      if (ACTIVE_STATUSES.includes(b.status)) map[name].active++;
      if (b.priority === 'Critical') map[name].critical++;
    }
    return Object.entries(map)
      .map(([assignee, s]) => ({ assignee, ...s }))
      .sort((a, b) => b.total - a.total);
  }, [bugs]);

  // ── List computations ──────────────────────────────────────────────────────
  const filteredBugs = useMemo(() => bugs.filter(b => {
    if (filterStatus !== '__all__' && b.status !== filterStatus) return false;
    if (filterPriority !== '__all__' && b.priority !== filterPriority) return false;
    if (filterSeverity !== '__all__' && b.severity !== filterSeverity) return false;
    return true;
  }), [bugs, filterStatus, filterPriority, filterSeverity]);

  const totalPages = Math.max(1, Math.ceil(filteredBugs.length / PAGE_SIZE));
  const pagedBugs = filteredBugs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allStatuses = useMemo(() => Array.from(new Set(bugs.map(b => b.status).filter(Boolean))).sort(), [bugs]);
  const allPriorities = useMemo(() => Array.from(new Set(bugs.map(b => b.priority).filter(Boolean))).sort(), [bugs]);
  const allSeverities = useMemo(() => Array.from(new Set(bugs.map(b => b.severity).filter(Boolean))).sort(), [bugs]);
  useEffect(() => { setPage(1); }, [filterStatus, filterPriority, filterSeverity]);

  const exportPdf = useCallback(async () => {
    const target = activeTab === 'summary' ? summaryRef.current : listRef.current;
    if (!target) return;
    setExportingPdf(true);
    try {
      const { toPng } = await import('html-to-image');
      const { default: jsPDF } = await import('jspdf');

      // Expand all overflow-hidden/auto elements so html-to-image captures full content
      type Saved = { el: HTMLElement; ov: string; ovX: string; w: string; mw: string };
      const saved: Saved[] = [];
      target.querySelectorAll<HTMLElement>('*').forEach(el => {
        const cs = window.getComputedStyle(el);
        if (cs.overflowX === 'auto' || cs.overflowX === 'hidden' || cs.overflow === 'hidden') {
          saved.push({ el, ov: el.style.overflow, ovX: el.style.overflowX, w: el.style.width, mw: el.style.maxWidth });
          el.style.overflow = 'visible';
          el.style.overflowX = 'visible';
          el.style.width = el.scrollWidth + 'px';
          el.style.maxWidth = 'none';
        }
      });
      const origOv = target.style.overflow;
      const origW  = target.style.width;
      target.style.overflow = 'visible';
      target.style.width = target.scrollWidth + 'px';
      const fullW = target.scrollWidth;
      const fullH = target.scrollHeight;

      const dataUrl = await toPng(target, { cacheBust: true, backgroundColor: '#ffffff', width: fullW, height: fullH });

      // Restore
      target.style.overflow = origOv;
      target.style.width = origW;
      saved.forEach(s => {
        s.el.style.overflow = s.ov;
        s.el.style.overflowX = s.ovX;
        s.el.style.width = s.w;
        s.el.style.maxWidth = s.mw;
      });

      // Build PDF
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      const HEADER_H = 18;
      const CONTENT_Y = HEADER_H + 1;

      const tabLabel   = activeTab === 'summary' ? 'Bug Summary' : 'Bug List';
      const snapLabel  = selectedDate ? 'Snapshot: ' + selectedDate : 'All snapshots';
      const exportDate = new Date().toISOString().split('T')[0];
      const pName      = projectName || ('Project #' + id);

      // Page-1 header bar (red)
      pdf.setFillColor(239, 68, 68);
      pdf.rect(0, 0, pdfW, HEADER_H, 'F');
      pdf.setFontSize(12);
      pdf.setFont('helvetica', 'bold');
      pdf.setTextColor(255, 255, 255);
      pdf.text(pName, 10, 8);
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(254, 202, 202);
      pdf.text(tabLabel + '   ' + snapLabel + '   Export: ' + exportDate, 10, 14);

      // Scale image to page width then paginate vertically
      const imgProps = pdf.getImageProperties(dataUrl);
      const scale    = pdfW / imgProps.width;
      const imgH_mm  = imgProps.height * scale;
      const availH   = pdfH - CONTENT_Y;

      if (imgH_mm <= availH) {
        pdf.addImage(dataUrl, 'PNG', 0, CONTENT_Y, pdfW, imgH_mm);
      } else {
        const canvas = document.createElement('canvas');
        const img    = new Image();
        await new Promise<void>(res => { img.onload = () => res(); img.src = dataUrl; });
        canvas.width = img.width;
        const pageHpx = Math.floor(availH / scale);
        let offsetY = 0;
        let pageNum = 0;
        while (offsetY < img.height) {
          if (pageNum > 0) {
            pdf.addPage();
            pdf.setFillColor(239, 68, 68);
            pdf.rect(0, 0, pdfW, 10, 'F');
            pdf.setFontSize(8);
            pdf.setFont('helvetica', 'normal');
            pdf.setTextColor(254, 202, 202);
            pdf.text(pName + '  |  ' + tabLabel + '  |  ' + snapLabel + '  |  Export: ' + exportDate, 10, 6.5);
          }
          const sliceH = Math.min(pageHpx, img.height - offsetY);
          canvas.height = sliceH;
          const ctx = canvas.getContext('2d')!;
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, -offsetY);
          const topY = pageNum === 0 ? CONTENT_Y : 11;
          pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, topY, pdfW, sliceH * scale);
          offsetY += pageHpx;
          pageNum++;
        }
      }

      const safeName = pName.replace(/[^a-z0-9\-_ ]/gi, '').trim().replace(/\s+/g, '-').toLowerCase();
      pdf.save('bugs-' + safeName + '-' + (selectedDate || 'all') + '-' + activeTab + '.pdf');
    } catch (e) {
      toast.error('Export PDF failed');
      console.error(e);
    }
    setExportingPdf(false);
  }, [activeTab, id, selectedDate, projectName]);

  return (
    <div className="flex h-screen bg-slate-50">
      <Sidebar projectId={id} />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">

          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500 flex items-center justify-center">
                <Bug className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Bug Tracking</h1>
                <p className="text-xs text-slate-500">
                  {snapshotDates.length > 0
                    ? `${snapshotDates.length} snapshot · ${bugs.length} bug đang hiển thị`
                    : 'Chưa có dữ liệu — Import từ Jira CSV'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {bugs.length > 0 && (
                <Button
                  variant="outline"
                  onClick={exportPdf}
                  disabled={exportingPdf}
                  className="gap-2 h-9 text-sm"
                >
                  <Download className="h-4 w-4" />
                  {exportingPdf ? 'Đang xuất...' : 'Export PDF'}
                </Button>
              )}
              <Button variant="outline" onClick={() => setJiraSyncOpen(true)} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Sync from Jira
              </Button>
              <Button onClick={() => setImportOpen(true)} className="gap-2 bg-red-500 hover:bg-red-600">
                <Upload className="h-4 w-4" />
                Import Bugs
              </Button>
            </div>
          </div>

          {/* Snapshot date bar */}
          {snapshotDates.length > 0 && (
            <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 mb-4 shadow-sm">
              <History className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-xs font-medium text-slate-500 shrink-0">Snapshot:</span>
              <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                {snapshotDates.map(d => (
                  <button
                    key={d.snapshot_date}
                    onClick={() => handleDateChange(d.snapshot_date)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                      selectedDate === d.snapshot_date
                        ? 'bg-red-500 text-white border-red-500 shadow-sm'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-red-300 hover:text-red-600'
                    }`}
                  >
                    <Calendar className="h-3 w-3 shrink-0" />
                    {d.snapshot_date}
                    <span className={`text-[10px] ${selectedDate === d.snapshot_date ? 'text-red-100' : 'text-slate-400'}`}>
                      ({d.count})
                    </span>
                  </button>
                ))}
              </div>
              {selectedDate && (
                <Button variant="ghost" size="sm" className="gap-1 text-xs text-slate-400 hover:text-red-500 h-7 px-2 shrink-0"
                  disabled={deletingDate} onClick={handleDeleteSnapshot}>
                  <Trash2 className="h-3.5 w-3.5" />
                  {deletingDate ? 'Đang xóa...' : 'Xóa snapshot này'}
                </Button>
              )}
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 bg-white border border-slate-200 rounded-lg p-1 w-fit mb-6 shadow-sm">
            {(['summary', 'list'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`px-5 py-1.5 text-sm font-medium rounded-md transition-all ${
                  activeTab === tab ? 'bg-red-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}>
                {tab === 'summary' ? 'Summary' : 'Bug List'}
              </button>
            ))}
          </div>

          {loading && (
            <div className="flex items-center justify-center h-48 text-slate-400">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-red-500 border-t-transparent" />
            </div>
          )}

          {!loading && bugs.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3">
              <Bug className="h-12 w-12 text-slate-200" />
              <p className="text-sm">Chưa có dữ liệu bug. Bấm <strong>Import Bugs</strong> để bắt đầu.</p>
            </div>
          )}

          {/* ── Summary Tab ────────────────────────────────────────────────────── */}
          {!loading && bugs.length > 0 && activeTab === 'summary' && (
            <div ref={summaryRef} className="space-y-6 bg-white rounded-xl p-4">
              <div className="grid grid-cols-4 gap-4">

                {/* Active bugs table */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
                    <Bug className="h-4 w-4 text-red-500" />
                    <h3 className="font-semibold text-slate-700 text-sm">Bug đang xử lý</h3>
                  </div>
                  <div className="p-4">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-400 uppercase tracking-wide">
                          <th className="text-left pb-2 font-medium">Status</th>
                          <th className="text-right pb-2 font-medium">Số lượng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {ACTIVE_STATUSES.map(s => (
                          <tr key={s}>
                            <td className="py-2.5">
                              <div className="flex items-center gap-2">
                                {s === 'To Do' && <Clock className="h-3.5 w-3.5 text-slate-400" />}
                                {s === 'In Progress' && <RefreshCw className="h-3.5 w-3.5 text-blue-500" />}
                                {s === 'Reopen' && <RefreshCw className="h-3.5 w-3.5 text-orange-500" />}
                                <span className="text-slate-700 font-medium">{s}</span>
                              </div>
                            </td>
                            <td className="py-2.5 text-right">
                              <span className={`inline-block min-w-[2rem] text-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                activeCount[s] ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-400'
                              }`}>{activeCount[s] ?? 0}</span>
                            </td>
                          </tr>
                        ))}
                        <tr className="border-t-2 border-slate-200">
                          <td className="pt-3 font-semibold text-slate-700">Tổng</td>
                          <td className="pt-3 text-right">
                            <span className="inline-block min-w-[2rem] text-center px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">{activeTotal}</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Pie chart: Priority */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-700 text-sm">Priority</h3>
                    <p className="text-xs text-slate-400">Phân loại theo mức độ ưu tiên</p>
                  </div>
                  <div className="p-2" style={{ height: 220 }}>
                    {priorityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={priorityData} cx="50%" cy="50%" outerRadius={75}
                            dataKey="value" labelLine={false} label={renderCustomLabel}>
                            {priorityData.map(entry => (
                              <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] ?? '#94a3b8'} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value, name) => [value, name]} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-300 text-sm">Không có dữ liệu</div>
                    )}
                  </div>
                </div>

                {/* Pie chart: Status */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-700 text-sm">Trạng thái đang xử lý</h3>
                    <p className="text-xs text-slate-400">To Do / In Progress / Reopen</p>
                  </div>
                  <div className="p-2" style={{ height: 220 }}>
                    {statusChartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={statusChartData} cx="50%" cy="50%" outerRadius={75}
                            dataKey="value" labelLine={false} label={renderCustomLabel}>
                            {statusChartData.map(entry => (
                              <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? '#94a3b8'} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value, name) => [value, name]} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-300 text-sm">Không có dữ liệu</div>
                    )}
                  </div>
                </div>

                {/* Pie chart: Severity */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100">
                    <h3 className="font-semibold text-slate-700 text-sm">Severity</h3>
                    <p className="text-xs text-slate-400">Mức độ nghiêm trọng</p>
                  </div>
                  <div className="p-2" style={{ height: 220 }}>
                    {severityData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={severityData} cx="50%" cy="50%" outerRadius={75}
                            dataKey="value" labelLine={false} label={renderCustomLabel}>
                            {severityData.map(entry => (
                              <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name] ?? '#94a3b8'} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value, name) => [value, name]} />
                          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-300 text-sm">Chưa có dữ liệu severity</div>
                    )}
                  </div>
                </div>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-purple-200 shadow-sm p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
                    <FlaskConical className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{readyForTestCount}</p>
                    <p className="text-sm font-medium text-slate-600">Bug sẵn sàng kiểm thử</p>
                    <p className="text-xs text-slate-400 mt-0.5">Trạng thái: Ready for Test</p>
                  </div>
                  {readyForTestCount > 0 && bugs.length > 0 && (
                    <div className="ml-auto">
                      <span className="text-xs bg-purple-500 text-white px-2 py-1 rounded-full font-medium">
                        {Math.round(readyForTestCount / bugs.length * 100)}% tổng số
                      </span>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                    <Sparkles className="h-6 w-6 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-800">{newTodayCount}</p>
                    <p className="text-sm font-medium text-slate-600">Bug mới hôm nay</p>
                    <p className="text-xs text-slate-400 mt-0.5">Ngày tạo: {today}</p>
                  </div>
                  {newTodayCount > 0 && (
                    <div className="ml-auto"><Badge className="bg-amber-500 text-white border-0">Mới</Badge></div>
                  )}
                </div>
              </div>

              {/* Priority breakdown */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-4">Số Bug theo Priority</p>
                <div className="space-y-3">
                  {(['Critical', 'Major', 'Medium', 'Minor'] as const).map(priority => {
                    const count = bugs.filter(b => b.priority === priority).length;
                    const pct = bugs.length > 0 ? Math.round(count / bugs.length * 100) : 0;
                    const barColors: Record<string, string> = {
                      Critical: 'bg-red-500',
                      Major:    'bg-orange-400',
                      Medium:   'bg-yellow-400',
                      Minor:    'bg-green-400',
                    };
                    return (
                      <div key={priority} className="flex items-center gap-3">
                        <div className="w-20 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${PRIORITY_BADGE[priority]}`}>
                            {priority}
                          </span>
                        </div>
                        <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${barColors[priority]}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 min-w-[4rem] justify-end">
                          <span className="text-sm font-bold text-slate-700">{count}</span>
                          <span className="text-xs text-slate-400">({pct}%)</span>
                        </div>
                      </div>
                    );
                  })}
                  <div className="flex items-center gap-3 pt-2 border-t border-slate-100 mt-1">
                    <div className="w-20 shrink-0 text-xs font-semibold text-slate-500">Tổng</div>
                    <div className="flex-1" />
                    <div className="flex items-center gap-1.5 shrink-0 min-w-[4rem] justify-end">
                      <span className="text-sm font-bold text-slate-800">{bugs.length}</span>
                      <span className="text-xs text-slate-400">(100%)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Severity breakdown */}
              {severityData.length > 0 && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                  <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-4">Số Bug theo Severity</p>
                  <div className="space-y-3">
                    {(['Critical', 'High', 'Medium', 'Low'] as const).map(severity => {
                      const count = bugs.filter(b => b.severity === severity).length;
                      if (count === 0) return null;
                      const pct = bugs.length > 0 ? Math.round(count / bugs.length * 100) : 0;
                      const barColors: Record<string, string> = {
                        Critical: 'bg-red-500', High: 'bg-orange-400', Medium: 'bg-yellow-400', Low: 'bg-green-400',
                      };
                      return (
                        <div key={severity} className="flex items-center gap-3">
                          <div className="w-20 shrink-0">
                            <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${SEVERITY_BADGE[severity]}`}>
                              {severity}
                            </span>
                          </div>
                          <div className="flex-1 bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${barColors[severity]}`} style={{ width: `${pct}%` }} />
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0 min-w-[4rem] justify-end">
                            <span className="text-sm font-bold text-slate-700">{count}</span>
                            <span className="text-xs text-slate-400">({pct}%)</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Status overview */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <p className="text-xs text-slate-400 uppercase tracking-wide font-medium mb-3">Tổng quan — {bugs.length} bug</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(
                    bugs.reduce((acc, b) => { acc[b.status] = (acc[b.status] ?? 0) + 1; return acc; }, {} as Record<string, number>)
                  ).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
                    <div key={status} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100">
                      <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_BADGE[status] ?? 'bg-slate-100 text-slate-600'}`}>{status}</span>
                      <span className="text-sm font-bold text-slate-700">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bug Leaders */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-red-50 border-b border-red-100">
                  <div className="flex items-center gap-2">
                    <Bug className="h-4 w-4 text-red-500" />
                    <span className="font-semibold text-red-700 text-sm">Bug Leaders</span>
                    <span className="text-xs text-red-500">— Assignee có nhiều hơn</span>
                    <input
                      type="number"
                      min={0}
                      value={bugThreshold}
                      onChange={e => setBugThreshold(Math.max(0, Number(e.target.value)))}
                      className="w-12 text-center rounded-md border border-red-200 bg-white text-red-700 font-bold text-sm px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-300"
                    />
                    <span className="text-xs text-red-500">bug</span>
                  </div>
                  <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-100 text-red-600 font-medium">
                    {assigneeStats.filter(a => a.total > bugThreshold).length} người
                  </span>
                </div>
                {assigneeStats.filter(a => a.total > bugThreshold).length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-slate-400">
                    Không có assignee nào có hơn {bugThreshold} bug
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 text-[10px] uppercase tracking-wide text-slate-500">
                          <th className="px-4 py-2.5 text-left w-8">#</th>
                          <th className="px-4 py-2.5 text-left">Assignee</th>
                          <th className="px-4 py-2.5 text-center">Tổng Bug</th>
                          <th className="px-4 py-2.5 text-center">Đang xử lý</th>
                          <th className="px-4 py-2.5 text-center">Critical</th>
                          <th className="px-4 py-2.5 text-left w-48">% Tổng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {assigneeStats.filter(a => a.total > bugThreshold).map((a, i) => {
                          const pct = bugs.length > 0 ? Math.round(a.total / bugs.length * 100) : 0;
                          return (
                            <tr key={a.assignee} className={`hover:bg-slate-50 transition-colors ${a.critical > 0 ? 'bg-red-50/20' : ''}`}>
                              <td className="px-4 py-2.5 text-xs text-slate-400">{i + 1}</td>
                              <td className="px-4 py-2.5">
                                <span className="font-medium text-slate-800">{a.assignee}</span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                                  {a.total}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                <span className={`inline-block min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold ${a.active > 0 ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-400'}`}>
                                  {a.active}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-center">
                                {a.critical > 0
                                  ? <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-bold bg-red-500 text-white">{a.critical}</span>
                                  : <span className="text-slate-300 text-xs">—</span>}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden min-w-[60px]">
                                    <div className="h-full bg-red-400 rounded-full" style={{ width: `${pct}%` }} />
                                  </div>
                                  <span className="text-xs text-slate-500 shrink-0">{pct}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── List Tab ────────────────────────────────────────────────────────── */}
          {!loading && bugs.length > 0 && activeTab === 'list' && (
            <div ref={listRef} className="space-y-4 bg-white rounded-xl p-4">
              <div className="flex items-center gap-3 bg-white rounded-xl border border-slate-200 px-4 py-3 shadow-sm">
                <span className="text-sm font-medium text-slate-600">Lọc:</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Status:</span>
                  <Select value={filterStatus} onValueChange={v => setFilterStatus(v ?? '__all__')}>
                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tất cả</SelectItem>
                      {allStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-400">Priority:</span>
                  <Select value={filterPriority} onValueChange={v => setFilterPriority(v ?? '__all__')}>
                    <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">Tất cả</SelectItem>
                      {allPriorities.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {allSeverities.length > 0 && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">Severity:</span>
                    <Select value={filterSeverity} onValueChange={v => setFilterSeverity(v ?? '__all__')}>
                      <SelectTrigger className="h-7 text-xs w-36"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__all__">Tất cả</SelectItem>
                        {allSeverities.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="ml-auto text-xs text-slate-400">
                  {filteredBugs.length} bug{filterStatus !== '__all__' || filterPriority !== '__all__' || filterSeverity !== '__all__' ? ` (lọc từ ${bugs.length})` : ''}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200">
                      <tr>
                        {['Issue Type','Key','ID','Summary','Assignee','Reporter','Priority','Severity','Status','Resolution','Created'].map(h => (
                          <th key={h} className="text-left px-3 py-3 font-semibold text-slate-600 text-xs whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedBugs.length === 0 ? (
                        <tr>
                          <td colSpan={11} className="px-3 py-8 text-center text-slate-400 text-sm">
                            Không có bug nào khớp với bộ lọc
                          </td>
                        </tr>
                      ) : pagedBugs.map(bug => (
                        <tr key={bug.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-3 py-2.5">
                            {bug.issue_type
                              ? <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">{bug.issue_type}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <span className="text-xs font-mono text-blue-600 font-medium">{bug.issue_key || '—'}</span>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">{bug.issue_id || '—'}</td>
                          <td className="px-3 py-2.5">
                            <p className="text-xs text-slate-800 font-medium line-clamp-2 max-w-xs">{bug.summary}</p>
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">{bug.assignee || '—'}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-600">{bug.reporter || '—'}</td>
                          <td className="px-3 py-2.5">
                            {bug.priority
                              ? <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${PRIORITY_BADGE[bug.priority] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{bug.priority}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {bug.severity
                              ? <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${SEVERITY_BADGE[bug.severity] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>{bug.severity}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            {bug.status
                              ? <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[bug.status] ?? 'bg-slate-100 text-slate-600'}`}>{bug.status}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="px-3 py-2.5 text-xs text-slate-500">{bug.resolution || '—'}</td>
                          <td className="px-3 py-2.5 text-xs text-slate-500 whitespace-nowrap">{bug.created || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50">
                    <p className="text-xs text-slate-500">Trang {page}/{totalPages} · {filteredBugs.length} bug</p>
                    <div className="flex items-center gap-1">
                      <Button variant="outline" size="sm" className="h-7 px-2" disabled={page === 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 7) pageNum = i + 1;
                        else if (page <= 4) pageNum = i + 1;
                        else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                        else pageNum = page - 3 + i;
                        return (
                          <Button key={pageNum} variant={page === pageNum ? 'default' : 'outline'}
                            size="sm" className={`h-7 w-7 p-0 text-xs ${page === pageNum ? 'bg-red-500 hover:bg-red-600 border-0' : ''}`}
                            onClick={() => setPage(pageNum)}>
                            {pageNum}
                          </Button>
                        );
                      })}
                      <Button variant="outline" size="sm" className="h-7 px-2" disabled={page === totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      <BugImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        projectId={id}
        onImported={handleAfterImport}
      />
      <JiraSyncDialog
        open={jiraSyncOpen}
        onOpenChange={setJiraSyncOpen}
        projectId={id}
        mode="bug"
        onSynced={handleAfterImport}
      />
    </div>
  );
}
