'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import type { PeriodTrackingFilters, PeriodTrackingRow } from '../shared/types';

const STAGES = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'] as const;
const RAG_OPTIONS = [
  { value: 'green', label: 'Green' },
  { value: 'amber', label: 'Amber' },
  { value: 'red', label: 'Red' },
] as const;

const selectClass =
  'h-8 text-sm border border-input rounded-md px-2 bg-white min-w-[100px] max-w-[200px] truncate';

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function buildFilters(draft: PeriodTrackingFilters): PeriodTrackingFilters {
  const payload: PeriodTrackingFilters = {};
  if (draft.status) payload.status = draft.status;
  if (draft.lateness) payload.lateness = draft.lateness;
  if (draft.pm_user_id !== undefined) payload.pm_user_id = draft.pm_user_id;
  if (draft.stage) payload.stage = draft.stage;
  if (draft.rag) payload.rag = draft.rag;
  if (draft.technology_council === true) payload.technology_council = true;
  return payload;
}

type Props = {
  rows: PeriodTrackingRow[];
  disabled?: boolean;
  onApply: (filters: PeriodTrackingFilters) => void;
};

export function TrackingFiltersBar({ rows, disabled, onApply }: Props) {
  const [draft, setDraft] = useState<PeriodTrackingFilters>({});

  const pmOptions = useMemo(() => {
    const map = new Map<number, string>();
    for (const row of rows) {
      if (row.pm_user_id != null) {
        map.set(row.pm_user_id, row.pm_display_name ?? String(row.pm_user_id));
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [rows]);

  return (
    <div
      data-testid="tracking-filter-bar"
      className="mb-4 rounded-md border bg-white p-3"
    >
      <div className="flex flex-wrap gap-2 items-end">
        <FieldRow label="Status">
          <select
            aria-label="Status"
            className={selectClass}
            value={draft.status ?? ''}
            onChange={(e) =>
              setDraft((prev) => {
                const next = { ...prev };
                const v = e.target.value;
                if (v === 'not_submitted' || v === 'draft' || v === 'submitted' || v === 'overdue') {
                  next.status = v;
                } else {
                  delete next.status;
                }
                return next;
              })
            }
          >
            <option value="">All</option>
            <option value="not_submitted">Not submitted</option>
            <option value="draft">Draft</option>
            <option value="submitted">Submitted</option>
            <option value="overdue">Overdue</option>
          </select>
        </FieldRow>

        <FieldRow label="Lateness">
          <select
            aria-label="Lateness"
            className={selectClass}
            value={draft.lateness ?? ''}
            onChange={(e) =>
              setDraft((prev) => {
                const next = { ...prev };
                const v = e.target.value;
                if (v === 'on_time' || v === 'late') next.lateness = v;
                else delete next.lateness;
                return next;
              })
            }
          >
            <option value="">All</option>
            <option value="on_time">On time</option>
            <option value="late">Late</option>
          </select>
        </FieldRow>

        <FieldRow label="PM">
          <select
            aria-label="PM"
            className={selectClass}
            value={draft.pm_user_id ?? ''}
            onChange={(e) =>
              setDraft((prev) => {
                const next = { ...prev };
                if (e.target.value) next.pm_user_id = Number(e.target.value);
                else delete next.pm_user_id;
                return next;
              })
            }
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
            value={draft.stage ?? ''}
            onChange={(e) =>
              setDraft((prev) => {
                const next = { ...prev };
                if (e.target.value) next.stage = e.target.value;
                else delete next.stage;
                return next;
              })
            }
          >
            <option value="">All</option>
            {STAGES.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
        </FieldRow>

        <FieldRow label="RAG">
          <select
            aria-label="RAG"
            className={selectClass}
            value={draft.rag ?? ''}
            onChange={(e) =>
              setDraft((prev) => {
                const next = { ...prev };
                if (e.target.value) next.rag = e.target.value;
                else delete next.rag;
                return next;
              })
            }
          >
            <option value="">All</option>
            {RAG_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </FieldRow>

        <div className="flex items-center gap-2 pb-0.5">
          <input
            id="technology-council-filter"
            type="checkbox"
            aria-label="Technology council"
            className="h-4 w-4"
            checked={draft.technology_council === true}
            onChange={(e) =>
              setDraft((prev) => {
                const next = { ...prev };
                if (e.target.checked) next.technology_council = true;
                else delete next.technology_council;
                return next;
              })
            }
          />
          <Label htmlFor="technology-council-filter" className="text-xs font-semibold text-slate-600">
            Technology council
          </Label>
        </div>

        <Button
          type="button"
          className="bg-blue-600 hover:bg-blue-700 h-8"
          disabled={disabled}
          onClick={() => onApply(buildFilters(draft))}
        >
          Apply filters
        </Button>
      </div>
    </div>
  );
}
