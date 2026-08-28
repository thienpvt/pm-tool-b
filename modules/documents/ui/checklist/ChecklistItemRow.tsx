'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
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
import { TableCell, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import type { ChecklistItem, ChecklistStatus } from '../shared/types';
import type { PatchItemResult } from './useProjectChecklist';
import { safeHttpsHref } from '@/lib/documents/https-url';

const STATUS_LABEL: Record<ChecklistStatus, string> = {
  none: 'None',
  drafting: 'Drafting',
  pending_approval: 'Pending approval',
  approved: 'Approved',
  not_applicable: 'Not applicable',
};

const STATUS_BADGE: Record<ChecklistStatus, string> = {
  none: 'bg-slate-100 text-slate-700',
  drafting: 'border border-amber-300 text-amber-700 bg-amber-50',
  pending_approval: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  not_applicable: 'bg-slate-100 text-slate-500',
};

const STATUS_OPTIONS: { value: ChecklistStatus; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'drafting', label: 'Drafting' },
  { value: 'pending_approval', label: 'Pending approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'not_applicable', label: 'Not applicable' },
];

type Props = {
  item: ChecklistItem;
  saving: boolean;
  onSave: (itemId: number, body: Record<string, unknown>) => Promise<PatchItemResult>;
};

function buildPatchBody(
  status: ChecklistStatus,
  confluenceUrl: string,
  approvedAt: string,
  approvedBy: string,
  naReason: string,
  notes: string,
): Record<string, unknown> {
  const body: Record<string, unknown> = { status };

  if (status === 'approved') {
    body.approved_at = approvedAt;
    body.approved_by = approvedBy;
    body.confluence_url = confluenceUrl;
  } else if (status === 'not_applicable') {
    body.na_reason = naReason;
  } else if (status === 'pending_approval') {
    body.confluence_url = confluenceUrl;
  } else {
    body.confluence_url = confluenceUrl;
  }

  if (notes.trim()) {
    body.notes = notes;
  }

  return body;
}

export function ChecklistItemRow({ item, saving, onSave }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<ChecklistStatus>(item.status);
  const [confluenceUrl, setConfluenceUrl] = useState(item.confluence_url ?? '');
  const [approvedAt, setApprovedAt] = useState(item.approved_at ?? '');
  const [approvedBy, setApprovedBy] = useState(item.approved_by ?? '');
  const [naReason, setNaReason] = useState(item.na_reason ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setStatus(item.status);
    setConfluenceUrl(item.confluence_url ?? '');
    setApprovedAt(item.approved_at ?? '');
    setApprovedBy(item.approved_by ?? '');
    setNaReason(item.na_reason ?? '');
    setNotes(item.notes ?? '');
    setFieldErrors({});
  }, [item]);

  const handleSave = async () => {
    setFieldErrors({});
    const result = await onSave(
      item.id,
      buildPatchBody(status, confluenceUrl, approvedAt, approvedBy, naReason, notes),
    );
    if (!result.ok && result.field) {
      setFieldErrors({ [result.field]: result.message });
    }
    if (result.ok) {
      setExpanded(false);
    }
  };

  const showHttpsLink = confluenceUrl.startsWith('https://');
  const confluenceHref = safeHttpsHref(item.confluence_url);

  return (
    <>
      <TableRow>
        <TableCell className="p-2 text-sm">
          <span>{item.catalog_name}</span>
          {item.catalog_mandatory ? (
            <Badge className="ml-2 bg-slate-100 text-slate-700 text-xs">Mandatory</Badge>
          ) : null}
          {item.status === 'not_applicable' && item.na_reason && !expanded ? (
            <p
              className="text-xs text-muted-foreground mt-1 max-w-[200px] truncate"
              title={item.na_reason}
            >
              {item.na_reason}
            </p>
          ) : null}
        </TableCell>
        <TableCell className="p-2 text-sm">{item.catalog_stage}</TableCell>
        <TableCell className="p-2 text-sm">
          <Badge className={STATUS_BADGE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
        </TableCell>
        <TableCell className="p-2 text-sm">
          {confluenceHref ? (
            <a
              href={confluenceHref}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Open
            </a>
          ) : item.confluence_url ? (
            <span className="text-muted-foreground">{item.confluence_url}</span>
          ) : (
            '—'
          )}
        </TableCell>
        <TableCell className="p-2 text-sm">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={() => setExpanded((open) => !open)}
          >
            Edit checklist item
          </Button>
        </TableCell>
      </TableRow>

      {expanded ? (
        <TableRow>
          <TableCell colSpan={5} className="p-4 bg-slate-50">
            <div className="space-y-4 max-w-xl">
              <div className="space-y-1.5">
                <Label htmlFor={`status-${item.id}`} className="text-xs font-semibold text-slate-600">
                  Status
                </Label>
                <Select value={status} onValueChange={(value) => setStatus(value as ChecklistStatus)}>
                  <SelectTrigger
                    id={`status-${item.id}`}
                    className="h-8 text-sm"
                    aria-label="Status"
                  >
                    <SelectValue>{STATUS_LABEL[status]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label
                  htmlFor={`confluence-${item.id}`}
                  className="text-xs font-semibold text-slate-600"
                >
                  Confluence URL
                </Label>
                <Input
                  id={`confluence-${item.id}`}
                  type="url"
                  className="h-8 text-sm"
                  aria-label="Confluence URL"
                  value={confluenceUrl}
                  onChange={(e) => setConfluenceUrl(e.target.value)}
                />
                {fieldErrors.confluence_url ? (
                  <p className="text-red-600 text-xs">{fieldErrors.confluence_url}</p>
                ) : null}
                {showHttpsLink ? (
                  <a
                    href={confluenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 text-xs hover:underline"
                  >
                    Open in Confluence
                  </a>
                ) : null}
              </div>

              {status === 'approved' ? (
                <>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`approved-at-${item.id}`}
                      className="text-xs font-semibold text-slate-600"
                    >
                      Approved date
                    </Label>
                    <Input
                      id={`approved-at-${item.id}`}
                      type="date"
                      className="h-8 text-sm"
                      aria-label="Approved date"
                      value={approvedAt}
                      onChange={(e) => setApprovedAt(e.target.value)}
                    />
                    {fieldErrors.approved_at ? (
                      <p className="text-red-600 text-xs">{fieldErrors.approved_at}</p>
                    ) : null}
                  </div>
                  <div className="space-y-1.5">
                    <Label
                      htmlFor={`approved-by-${item.id}`}
                      className="text-xs font-semibold text-slate-600"
                    >
                      Approved by
                    </Label>
                    <Input
                      id={`approved-by-${item.id}`}
                      className="h-8 text-sm"
                      aria-label="Approved by"
                      value={approvedBy}
                      onChange={(e) => setApprovedBy(e.target.value)}
                    />
                    {fieldErrors.approved_by ? (
                      <p className="text-red-600 text-xs">{fieldErrors.approved_by}</p>
                    ) : null}
                  </div>
                </>
              ) : null}

              {status === 'not_applicable' ? (
                <div className="space-y-1.5">
                  <Label
                    htmlFor={`na-reason-${item.id}`}
                    className="text-xs font-semibold text-slate-600"
                  >
                    N/A reason
                  </Label>
                  <Textarea
                    id={`na-reason-${item.id}`}
                    rows={2}
                    className="text-sm"
                    aria-label="N/A reason"
                    value={naReason}
                    onChange={(e) => setNaReason(e.target.value)}
                  />
                  {fieldErrors.na_reason ? (
                    <p className="text-red-600 text-xs">{fieldErrors.na_reason}</p>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-1.5">
                <Label htmlFor={`notes-${item.id}`} className="text-xs font-semibold text-slate-600">
                  Notes
                </Label>
                <Textarea
                  id={`notes-${item.id}`}
                  rows={2}
                  className="text-sm"
                  aria-label="Notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <Button
                type="button"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                disabled={saving}
                onClick={handleSave}
              >
                Save checklist item
              </Button>
            </div>
          </TableCell>
        </TableRow>
      ) : null}
    </>
  );
}
