'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { ComplianceFilters } from '@/modules/documents/ui/shared/types';

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

const STAGES = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'] as const;
const STATUSES = ['Active', 'Completed', 'Paused', 'Cancelled', 'Other'] as const;
const RAG_OPTIONS = [
  { value: 'Green', label: 'Green' },
  { value: 'Amber', label: 'Amber' },
  { value: 'Red', label: 'Red' },
  { value: 'Not applicable', label: 'Not applicable' },
] as const;

const selectClass =
  'h-8 text-sm border border-input rounded-md px-2 bg-white min-w-[100px] max-w-[200px] truncate';

type ProgramOption = { id: number; name: string };

type ComplianceFiltersBarProps = {
  filters: ComplianceFilters;
  refreshing: boolean;
  filterError?: string | null;
  onApply: (filters: ComplianceFilters) => void | Promise<void>;
  onClear: () => void | Promise<void>;
};

function str(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function buildPayload(draft: ComplianceFilters): ComplianceFilters {
  const payload: ComplianceFilters = {};
  if (draft.stage) payload.stage = String(draft.stage);
  if (draft.status) payload.status = String(draft.status);
  if (draft.rag) payload.rag = String(draft.rag);
  if (draft.program !== undefined && draft.program !== '') {
    payload.program = Number(draft.program);
  }
  return payload;
}

export function ComplianceFiltersBar({
  filters,
  refreshing,
  filterError,
  onApply,
  onClear,
}: ComplianceFiltersBarProps) {
  const [draft, setDraft] = useState<ComplianceFilters>(filters);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  useEffect(() => {
    fetch('/api/programs')
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Array<{ id: number; name?: string }>) => {
        setPrograms(
          rows.map((row) => ({
            id: row.id,
            name: row.name ?? String(row.id),
          })),
        );
      })
      .catch(() => setPrograms([]));
  }, []);

  const setField = (key: keyof ComplianceFilters, value: unknown) => {
    setDraft((prev) => {
      const next = { ...prev };
      if (value === '' || value === undefined) {
        delete next[key];
      } else if (key === 'program') {
        next.program = value ? Number(value) : undefined;
      } else {
        (next as Record<string, unknown>)[key] = value;
      }
      return next;
    });
  };

  return (
    <Card size="sm" className="mb-4 p-3" data-testid="compliance-filter-bar">
      <div className="flex flex-wrap gap-2 items-end">
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
            {STATUSES.map((status) => (
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
            {RAG_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
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
            {programs.map(({ id, name }) => (
              <option key={id} value={id} title={name}>
                {name}
              </option>
            ))}
          </select>
        </FieldRow>

        <Button
          type="button"
          className="bg-blue-600 hover:bg-blue-700 h-8"
          disabled={refreshing}
          onClick={() => onApply(buildPayload(draft))}
        >
          Apply filters
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-8"
          disabled={refreshing}
          onClick={onClear}
        >
          Clear filters
        </Button>
      </div>
      {filterError ? (
        <p className="text-red-600 text-xs mt-2" data-testid="compliance-filter-error">
          {filterError}
        </p>
      ) : null}
    </Card>
  );
}
