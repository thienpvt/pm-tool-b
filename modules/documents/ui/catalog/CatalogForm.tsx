'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CatalogRow } from '../shared/types';

const STAGES = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'ALL'] as const;

export type CatalogFormValues = {
  name: string;
  purpose: string;
  stage: string;
  mandatory: boolean;
  apply_to_in_flight: boolean;
  active?: boolean;
};

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

const EMPTY_CREATE: CatalogFormValues = {
  name: '',
  purpose: '',
  stage: 'L2',
  mandatory: false,
  apply_to_in_flight: false,
};

type CreateProps = {
  mode: 'create';
  saving: boolean;
  onSubmit: (values: CatalogFormValues) => void | Promise<void>;
};

type EditProps = {
  mode: 'edit';
  initial: CatalogRow;
  saving: boolean;
  onSubmit: (values: CatalogFormValues) => void | Promise<void>;
  onRetire?: () => void;
  onCancel?: () => void;
};

type Props = CreateProps | EditProps;

export function CatalogForm(props: Props) {
  const initialValues: CatalogFormValues =
    props.mode === 'edit'
      ? {
          name: props.initial.name,
          purpose: props.initial.purpose ?? '',
          stage: props.initial.stage,
          mandatory: props.initial.mandatory,
          apply_to_in_flight: false,
          active: props.initial.active,
        }
      : EMPTY_CREATE;

  const [name, setName] = useState(initialValues.name);
  const [purpose, setPurpose] = useState(initialValues.purpose);
  const [stage, setStage] = useState(initialValues.stage);
  const [mandatory, setMandatory] = useState(initialValues.mandatory);
  const [applyToInFlight, setApplyToInFlight] = useState(initialValues.apply_to_in_flight);
  const [active, setActive] = useState(initialValues.active ?? true);

  useEffect(() => {
    if (props.mode === 'edit') {
      setName(props.initial.name);
      setPurpose(props.initial.purpose ?? '');
      setStage(props.initial.stage);
      setMandatory(props.initial.mandatory);
      setApplyToInFlight(false);
      setActive(props.initial.active);
    }
  }, [props]);

  const values: CatalogFormValues = {
    name,
    purpose,
    stage,
    mandatory,
    apply_to_in_flight: applyToInFlight,
    ...(props.mode === 'edit' ? { active } : {}),
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void props.onSubmit(values);
  };

  const testId = props.mode === 'create' ? 'catalog-create-form' : 'catalog-edit-form';
  const submitLabel = props.mode === 'create' ? 'Add catalog item' : 'Save catalog item';

  return (
    <Card size="sm" data-testid={testId} className="mb-4 px-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldRow label="Name">
            <Input
              id="catalog-name"
              aria-label="Name"
              className="h-8 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Stage">
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="h-8 text-sm" aria-label="Stage">
                <SelectValue placeholder="Select stage">{stage}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FieldRow>
        </div>
        <FieldRow label="Purpose">
          <Textarea
            aria-label="Purpose"
            rows={2}
            className="text-sm"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
          />
        </FieldRow>
        <div className="flex flex-wrap gap-6 items-center">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              aria-label="Mandatory"
              className="h-4 w-4"
              checked={mandatory}
              onChange={(e) => setMandatory(e.target.checked)}
            />
            Mandatory
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              aria-label="Apply to in-flight projects"
              className="h-4 w-4"
              checked={applyToInFlight}
              onChange={(e) => setApplyToInFlight(e.target.checked)}
            />
            Apply to in-flight projects
          </label>
          {props.mode === 'edit' ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                aria-label="Active"
                className="h-4 w-4"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active
            </label>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Button
            type="submit"
            size="sm"
            disabled={props.saving}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            {submitLabel}
          </Button>
          {props.mode === 'edit' && props.onRetire ? (
            <Button type="button" size="sm" variant="outline" onClick={props.onRetire}>
              Retire item
            </Button>
          ) : null}
          {props.mode === 'edit' && props.onCancel ? (
            <Button type="button" size="sm" variant="ghost" onClick={props.onCancel}>
              Cancel
            </Button>
          ) : null}
        </div>
      </form>
    </Card>
  );
}
