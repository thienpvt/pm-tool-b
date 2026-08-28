'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { AuditFilters } from '@/modules/documents/ui/shared/types';

const LIMIT_OPTIONS = [50, 100, 200] as const;

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

type AuditFiltersBarProps = {
  filters: AuditFilters;
  refreshing: boolean;
  onApply: (filters: AuditFilters) => void | Promise<void>;
};

function buildPayload(draft: AuditFilters): AuditFilters {
  const payload: AuditFilters = { limit: draft.limit ?? 50 };
  if (draft.entity_type?.trim()) payload.entity_type = draft.entity_type.trim();
  if (draft.entity_id?.trim()) payload.entity_id = draft.entity_id.trim();
  if (draft.from) payload.from = draft.from;
  if (draft.to) payload.to = draft.to;
  return payload;
}

export function AuditFiltersBar({ filters, refreshing, onApply }: AuditFiltersBarProps) {
  const [draft, setDraft] = useState<AuditFilters>(filters);

  useEffect(() => {
    setDraft(filters);
  }, [filters]);

  const limit = draft.limit ?? 50;

  return (
    <Card size="sm" className="mb-4 p-3" data-testid="audit-filter-bar">
      <div className="flex flex-wrap gap-2 items-end">
        <FieldRow label="Entity type">
          <Input
            aria-label="Entity type"
            className="h-8 text-sm max-w-[200px]"
            value={draft.entity_type ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, entity_type: e.target.value }))}
          />
        </FieldRow>

        <FieldRow label="Entity id">
          <Input
            aria-label="Entity id"
            className="h-8 text-sm max-w-[200px]"
            value={draft.entity_id ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, entity_id: e.target.value }))}
          />
        </FieldRow>

        <FieldRow label="From">
          <Input
            aria-label="From"
            type="date"
            className="h-8 text-sm"
            value={draft.from ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, from: e.target.value || undefined }))}
          />
        </FieldRow>

        <FieldRow label="To">
          <Input
            aria-label="To"
            type="date"
            className="h-8 text-sm"
            value={draft.to ?? ''}
            onChange={(e) => setDraft((prev) => ({ ...prev, to: e.target.value || undefined }))}
          />
        </FieldRow>

        <FieldRow label="Limit">
          <select
            aria-label="Limit"
            className="h-8 text-sm border border-input rounded-md px-2 bg-white min-w-[80px]"
            value={String(limit)}
            onChange={(e) =>
              setDraft((prev) => ({ ...prev, limit: Number(e.target.value) }))
            }
          >
            {LIMIT_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </FieldRow>

        <Button
          type="button"
          className="bg-blue-600 hover:bg-blue-700 h-8 text-white"
          disabled={refreshing}
          onClick={() => onApply(buildPayload(draft))}
        >
          Apply filters
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Showing up to {limit} most recent entries.
      </p>
    </Card>
  );
}
