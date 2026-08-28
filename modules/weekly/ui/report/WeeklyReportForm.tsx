'use client';

import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { WeeklyReportEditorShell, WeeklyRag } from '../shared/types';
import { RAG_OPTIONS, fieldHasError } from './useWeeklyReportEditor';

type PatchKey =
  | 'highlights'
  | 'completed_work'
  | 'next_week_goals'
  | 'nearest_milestone'
  | 'nearest_milestone_id'
  | 'raid_dependency'
  | 'leadership_support'
  | 'this_week_rag';

type Props = {
  shell: WeeklyReportEditorShell;
  editable: boolean;
  fieldErrors: string[];
  onPatchField: (partial: Partial<Record<PatchKey, unknown>>) => void;
};

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-xs font-semibold text-slate-600">
      {children}
    </Label>
  );
}

function FieldError({ show }: { show: boolean }) {
  if (!show) return null;
  return <p className="text-xs text-red-600 mt-1">Required before submit</p>;
}

export function WeeklyReportForm({ shell, editable, fieldErrors, onPatchField }: Props) {
  const ragValue = shell.this_week_rag ?? '';

  return (
    <div className="space-y-4 max-w-2xl" data-testid="weekly-report-form">
      <Card size="sm" className="px-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="this-week-rag">This week RAG</FieldLabel>
          <Select
            value={ragValue}
            disabled={!editable}
            onValueChange={(value) =>
              onPatchField({ this_week_rag: value as WeeklyRag })
            }
          >
            <SelectTrigger id="this-week-rag" className="h-8 text-sm" aria-label="This week RAG">
              <SelectValue placeholder="Select RAG">{ragValue || 'Select RAG'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {RAG_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card size="sm" className="px-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="highlights">Highlights</FieldLabel>
          <Textarea
            id="highlights"
            aria-label="Highlights"
            className="min-h-[80px] resize-y text-sm"
            disabled={!editable}
            value={shell.highlights ?? ''}
            onChange={(e) => onPatchField({ highlights: e.target.value })}
          />
        </div>
      </Card>

      <Card size="sm" className="px-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="completed-work">Completed work</FieldLabel>
          <Textarea
            id="completed-work"
            aria-label="Completed work"
            className="min-h-[80px] resize-y text-sm"
            disabled={!editable}
            value={shell.completed_work ?? ''}
            onChange={(e) => onPatchField({ completed_work: e.target.value })}
          />
        </div>
      </Card>

      <Card size="sm" className="px-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="next-week-goals">Next week goals</FieldLabel>
          <Textarea
            id="next-week-goals"
            aria-label="Next week goals"
            className="min-h-[80px] resize-y text-sm"
            disabled={!editable}
            value={shell.next_week_goals ?? ''}
            onChange={(e) => onPatchField({ next_week_goals: e.target.value })}
          />
        </div>
      </Card>

      <Card size="sm" className="px-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <FieldLabel htmlFor="nearest-milestone">Nearest milestone</FieldLabel>
            <Input
              id="nearest-milestone"
              aria-label="Nearest milestone"
              className="h-8 text-sm"
              disabled={!editable}
              value={shell.nearest_milestone ?? ''}
              onChange={(e) => onPatchField({ nearest_milestone: e.target.value })}
            />
            <FieldError show={fieldHasError(fieldErrors, 'nearest_milestone')} />
          </div>
          <div className="space-y-1.5">
            <FieldLabel htmlFor="nearest-milestone-id">Milestone ID (optional)</FieldLabel>
            <Input
              id="nearest-milestone-id"
              aria-label="Nearest milestone ID"
              className="h-8 text-sm"
              disabled={!editable}
              value={shell.nearest_milestone_id ?? ''}
              onChange={(e) => {
                const raw = e.target.value.trim();
                onPatchField({
                  nearest_milestone_id: raw === '' ? null : Number(raw),
                });
              }}
            />
            <FieldError show={fieldHasError(fieldErrors, 'nearest_milestone_id')} />
          </div>
        </div>
      </Card>

      <Card size="sm" className="px-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="raid-dependency">RAID dependency</FieldLabel>
          <Textarea
            id="raid-dependency"
            aria-label="RAID dependency"
            className="min-h-[80px] resize-y text-sm"
            disabled={!editable}
            value={shell.raid_dependency ?? ''}
            onChange={(e) => onPatchField({ raid_dependency: e.target.value })}
          />
          <FieldError show={fieldHasError(fieldErrors, 'raid_dependency')} />
        </div>
      </Card>

      <Card size="sm" className="px-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="leadership-support">Leadership support</FieldLabel>
          <Textarea
            id="leadership-support"
            aria-label="Leadership support"
            className="min-h-[80px] resize-y text-sm"
            disabled={!editable}
            value={shell.leadership_support ?? ''}
            onChange={(e) => onPatchField({ leadership_support: e.target.value })}
          />
          <FieldError show={fieldHasError(fieldErrors, 'leadership_support')} />
        </div>
      </Card>
    </div>
  );
}
