'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WeeklyConfig } from '../shared/types';

const WEEKDAYS = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
] as const;

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

function toTimeInputValue(dueTimeUtc: string): string {
  const match = dueTimeUtc.match(/^(\d{2}:\d{2})/);
  return match ? match[1] : dueTimeUtc;
}

function toApiTimeValue(timeInput: string): string {
  if (/^\d{2}:\d{2}:\d{2}$/.test(timeInput)) return timeInput;
  if (/^\d{2}:\d{2}$/.test(timeInput)) return `${timeInput}:00`;
  return timeInput;
}

type Props = {
  config: WeeklyConfig;
  saving: boolean;
  onSave: (config: WeeklyConfig) => void | Promise<void>;
};

export function WeeklyConfigForm({ config, saving, onSave }: Props) {
  const [dueWeekday, setDueWeekday] = useState(String(config.due_weekday));
  const [dueTimeUtc, setDueTimeUtc] = useState(toTimeInputValue(config.due_time_utc));

  useEffect(() => {
    setDueWeekday(String(config.due_weekday));
    setDueTimeUtc(toTimeInputValue(config.due_time_utc));
  }, [config.due_weekday, config.due_time_utc]);

  return (
    <Card size="sm" data-testid="weekly-config-form" className="mb-6 px-4">
      <div className="flex flex-wrap gap-4 items-end">
        <FieldRow label="Due weekday">
          <Select value={dueWeekday} onValueChange={setDueWeekday}>
            <SelectTrigger className="h-8 text-sm min-w-[140px]" aria-label="Due weekday">
              <SelectValue placeholder="Select weekday">
                {WEEKDAYS.find((w) => w.value === dueWeekday)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {WEEKDAYS.map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FieldRow>

        <FieldRow label="Due time (UTC)">
          <Input
            type="time"
            className="h-8 text-sm w-[140px]"
            aria-label="Due time (UTC)"
            value={dueTimeUtc}
            onChange={(e) => setDueTimeUtc(e.target.value)}
          />
        </FieldRow>

        <Button
          size="sm"
          disabled={saving}
          className="bg-blue-600 text-white hover:bg-blue-700"
          onClick={() =>
            onSave({
              due_weekday: Number(dueWeekday),
              due_time_utc: toApiTimeValue(dueTimeUtc),
            })
          }
        >
          Save schedule
        </Button>
      </div>
    </Card>
  );
}
