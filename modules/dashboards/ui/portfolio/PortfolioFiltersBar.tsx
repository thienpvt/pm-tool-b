'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { DashboardFilters } from '@/lib/dashboards/filters';
import type { PortfolioDashboardListRow } from '@/modules/dashboards/ui/shared/types';

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

const STAGES = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'] as const;
const RAG_OPTIONS = ['green', 'amber', 'red'] as const;

const selectClass =
  'h-8 text-sm border border-input rounded-md px-2 bg-white min-w-[100px] max-w-[200px] truncate';

type PortfolioFiltersBarProps = {
  filters: DashboardFilters;
  list: PortfolioDashboardListRow[];
  refreshing: boolean;
  disabled?: boolean;
  onApply: (filters: DashboardFilters) => void | Promise<void>;
  onClear: () => void | Promise<void>;
  onReset: () => void | Promise<void>;
};

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function weeklyValue(filters: DashboardFilters): string {
  if (!('weekly_report_enabled' in filters)) return '';
  return filters.weekly_report_enabled ? 'true' : 'false';
}

function buildPayload(draft: DashboardFilters): DashboardFilters {
  const payload: DashboardFilters = {};
  if (draft.portfolio_year !== undefined && draft.portfolio_year !== '') {
    payload.portfolio_year = Number(draft.portfolio_year);
  }
  if (draft.program !== undefined && draft.program !== '') {
    payload.program = Number(draft.program);
  }
  if (draft.unit !== undefined && draft.unit !== '') {
    payload.unit = String(draft.unit);
  }
  if (draft.pm_user_id !== undefined && draft.pm_user_id !== '') {
    payload.pm_user_id = Number(draft.pm_user_id);
  }
  if (draft.stage) payload.stage = String(draft.stage);
  if (draft.status) payload.status = String(draft.status);
  if (draft.rag) payload.rag = String(draft.rag);
  if (draft.type) payload.type = String(draft.type);
  if (draft.weekly_report_enabled === true || draft.weekly_report_enabled === false) {
    payload.weekly_report_enabled = draft.weekly_report_enabled;
  }
  return payload;
}

export function PortfolioFiltersBar({
  filters,
  list,
  refreshing,
  disabled,
  onApply,
  onClear,
  onReset,
}: PortfolioFiltersBarProps) {
  const [draft, setDraft] = useState<DashboardFilters>(filters);

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const programOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of list) {
      if (row.customer_id != null) {
        map.set(row.customer_id, row.program_name ?? String(row.customer_id));
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [list]);

  const pmOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of list) {
      if (row.pm_user_id != null) {
        map.set(row.pm_user_id, row.pm_name ?? String(row.pm_user_id));
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [list]);

  const statusOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of list) {
      if (row.status) set.add(row.status);
    }
    return Array.from(set);
  }, [list]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const row of list) {
      if (row.classification) set.add(row.classification);
    }
    return Array.from(set);
  }, [list]);

  const yearOptions = useMemo(() => {
    const set = new Set<number>();
    for (const row of list) {
      if (row.portfolio_year != null) set.add(row.portfolio_year);
    }
    return Array.from(set).sort((a, b) => a - b);
  }, [list]);

  const setField = (key: keyof DashboardFilters, value: unknown) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (value === '' || value === undefined) {
        delete next[key];
      } else if (key === 'weekly_report_enabled') {
        if (value === 'true') next.weekly_report_enabled = true;
        else if (value === 'false') next.weekly_report_enabled = false;
        else delete next.weekly_report_enabled;
      } else {
        (next as Record<string, unknown>)[key] = value;
      }
      return next;
    });
  };

  return (
    <Card size="sm" className="mb-4 p-3" data-testid="portfolio-filter-bar">
      <div className="flex flex-wrap gap-2 items-end">
        <FieldRow label="Year">
          <select
            aria-label="Year"
            className={selectClass}
            value={str(draft.portfolio_year)}
            onChange={(e) => setField('portfolio_year', e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All</option>
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Program">
          <select
            aria-label="Program"
            className={selectClass}
            value={str(draft.program)}
            onChange={(e) => setField('program', e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All</option>
            {programOptions.map(({ id, name }) => (
              <option key={id} value={id} title={name}>
                {name}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Unit">
          <input
            aria-label="Unit"
            type="text"
            className={`${selectClass} min-w-[120px]`}
            value={str(draft.unit)}
            onChange={(e) => setField('unit', e.target.value)}
          />
        </FieldRow>

        <FieldRow label="PM">
          <select
            aria-label="PM"
            className={selectClass}
            value={str(draft.pm_user_id)}
            onChange={(e) => setField('pm_user_id', e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">All</option>
            {pmOptions.map(({ id, name }) => (
              <option key={id} value={id} title={name}>
                {name}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Stage">
          <select
            aria-label="Stage"
            className={selectClass}
            value={str(draft.stage)}
            onChange={(e) => setField('stage', e.target.value)}
          >
            <option value="">All</option>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Status">
          <select
            aria-label="Status"
            className={selectClass}
            value={str(draft.status)}
            onChange={(e) => setField('status', e.target.value)}
          >
            <option value="">All</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="RAG">
          <select
            aria-label="RAG"
            className={selectClass}
            value={str(draft.rag)}
            onChange={(e) => setField('rag', e.target.value)}
          >
            <option value="">All</option>
            {RAG_OPTIONS.map((rag) => (
              <option key={rag} value={rag}>
                {rag}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Type">
          <select
            aria-label="Type"
            className={selectClass}
            value={str(draft.type)}
            onChange={(e) => setField('type', e.target.value)}
          >
            <option value="">All</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="Weekly report">
          <select
            aria-label="Weekly report"
            className={selectClass}
            value={weeklyValue(draft)}
            onChange={(e) => setField('weekly_report_enabled', e.target.value)}
          >
            <option value="">All</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        </FieldRow>

        <Button
          type="button"
          className="bg-blue-600 hover:bg-blue-700 h-8"
          disabled={disabled || refreshing}
          onClick={() => onApply(buildPayload(draft))}
        >
          Apply filters
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8"
          disabled={disabled || refreshing}
          onClick={onClear}
        >
          Clear filters
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8"
          disabled={disabled || refreshing}
          onClick={onReset}
        >
          Reset defaults
        </Button>
      </div>
    </Card>
  );
}
