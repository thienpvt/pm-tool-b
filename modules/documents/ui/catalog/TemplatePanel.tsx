'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { TemplateRow } from '../shared/types';

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-600">{label}</Label>
      {children}
    </div>
  );
}

type PublishPayload = {
  catalog_id: number;
  name: string;
  document_type: string;
  effective_date: string;
  guidance?: string;
  template_url: string;
};

type Props = {
  catalogId: number;
  templates: TemplateRow[];
  loading: boolean;
  publishing: boolean;
  retiringTemplateId: number | null;
  onPublish: (payload: PublishPayload) => Promise<
    | { ok: true }
    | { ok: false; field?: 'template_url'; message?: string }
  >;
  onRetireTemplate: (templateId: number, catalogId: number) => void | Promise<void>;
};

export function TemplatePanel({
  catalogId,
  templates,
  loading,
  publishing,
  retiringTemplateId,
  onPublish,
  onRetireTemplate,
}: Props) {
  const [name, setName] = useState('');
  const [documentType, setDocumentType] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [guidance, setGuidance] = useState('');
  const [templateUrl, setTemplateUrl] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setUrlError(null);

    if (!templateUrl.startsWith('https://')) {
      setUrlError('Template URL must use HTTPS');
      return;
    }

    const result = await onPublish({
      catalog_id: catalogId,
      name,
      document_type: documentType,
      effective_date: effectiveDate,
      guidance: guidance || undefined,
      template_url: templateUrl,
    });

    if (!result.ok && result.field === 'template_url') {
      setUrlError(result.message ?? 'Template URL must use HTTPS');
      return;
    }

    if (result.ok) {
      setName('');
      setDocumentType('');
      setEffectiveDate('');
      setGuidance('');
      setTemplateUrl('');
    }
  };

  return (
    <Card size="sm" data-testid="templates-panel" className="mt-6 px-4">
      <h2 className="text-base font-semibold mb-4">Templates</h2>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading templates…</p>
      ) : templates.length === 0 ? (
        <div className="py-6 text-center mb-4">
          <p className="font-semibold text-slate-600">No templates for this item</p>
          <p className="text-sm text-muted-foreground mt-1">
            Publish a template URL to give PMs a starting link.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto mb-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 px-2 text-xs font-semibold">Name</TableHead>
                <TableHead className="h-8 px-2 text-xs font-semibold">Type</TableHead>
                <TableHead className="h-8 px-2 text-xs font-semibold">Version</TableHead>
                <TableHead className="h-8 px-2 text-xs font-semibold">Effective</TableHead>
                <TableHead className="h-8 px-2 text-xs font-semibold">Template URL</TableHead>
                <TableHead className="h-8 px-2 text-xs font-semibold">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="p-2 text-sm">{row.name}</TableCell>
                  <TableCell className="p-2 text-sm">{row.document_type}</TableCell>
                  <TableCell className="p-2 text-sm">{row.version}</TableCell>
                  <TableCell className="p-2 text-sm">{row.effective_date}</TableCell>
                  <TableCell className="p-2 text-sm">
                    {row.template_url ? (
                      <a
                        href={row.template_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 truncate block max-w-[200px]"
                        title={row.template_url}
                      >
                        {row.name}
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="p-2 text-sm">
                    {!row.retired_at ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        disabled={retiringTemplateId === row.id}
                        onClick={() => void onRetireTemplate(row.id, catalogId)}
                      >
                        Retire template
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4 border-t pt-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FieldRow label="Name">
            <Input
              aria-label="Name"
              className="h-8 text-sm"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Document type">
            <Input
              aria-label="Document type"
              className="h-8 text-sm"
              value={documentType}
              onChange={(e) => setDocumentType(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Effective date">
            <Input
              type="date"
              aria-label="Effective date"
              className="h-8 text-sm"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              required
            />
          </FieldRow>
          <FieldRow label="Template URL">
            <Input
              type="url"
              aria-label="Template URL"
              className="h-8 text-sm"
              value={templateUrl}
              onChange={(e) => {
                setTemplateUrl(e.target.value);
                setUrlError(null);
              }}
              required
            />
            {urlError ? (
              <p className="text-red-600 text-xs mt-1">{urlError}</p>
            ) : null}
          </FieldRow>
        </div>
        <FieldRow label="Guidance">
          <Textarea
            aria-label="Guidance"
            rows={2}
            className="text-sm"
            value={guidance}
            onChange={(e) => setGuidance(e.target.value)}
          />
        </FieldRow>
        <div>
          <Button
            type="submit"
            size="sm"
            disabled={publishing}
            className="bg-blue-600 text-white hover:bg-blue-700"
          >
            Publish template
          </Button>
        </div>
      </form>
    </Card>
  );
}
