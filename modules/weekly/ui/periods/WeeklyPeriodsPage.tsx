'use client';

import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Sidebar from '@/components/layout/Sidebar';
import { WeeklyConfigForm } from './WeeklyConfigForm';
import { WeeklyPeriodList } from './WeeklyPeriodList';
import { useWeeklyPeriods } from './useWeeklyPeriods';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this page.",
  load_failed: "Couldn't load this page. Try again.",
} as const;

export default function WeeklyPeriodsPage() {
  const { data, config, loading, savingConfig, creatingPeriod, error, saveConfig, createPeriod } =
    useWeeklyPeriods();
  const [isoWeek, setIsoWeek] = useState('');

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading weekly periods…</p>
          </div>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-center px-4">
            <AlertTriangle className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-slate-600">{ERROR_COPY[error]}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!data) return null;

  const count = data.length;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
        <div className="mb-4">
          <h1 className="text-base font-semibold">Weekly periods</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {count} period{count === 1 ? '' : 's'}
          </p>
        </div>

        <WeeklyConfigForm config={config} saving={savingConfig} onSave={saveConfig} />

        <Card size="sm" data-testid="weekly-create-form" className="mb-6 px-4">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
              <Label htmlFor="iso-week-input" className="text-xs font-semibold text-slate-600">
                ISO week
              </Label>
              <Input
                id="iso-week-input"
                className="h-8 text-sm w-[160px]"
                placeholder="2026-W05"
                value={isoWeek}
                onChange={(e) => setIsoWeek(e.target.value)}
              />
            </div>
            <Button
              size="sm"
              disabled={creatingPeriod}
              className="bg-blue-600 text-white hover:bg-blue-700"
              onClick={() => createPeriod(isoWeek)}
            >
              Create period
            </Button>
          </div>
        </Card>

        <WeeklyPeriodList periods={data} />
      </main>
    </div>
  );
}
