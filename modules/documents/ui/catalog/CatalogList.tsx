'use client';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { CatalogRow } from '../shared/types';

const COLUMN_COUNT = 5;

type Props = {
  rows: CatalogRow[];
  selectedId?: number | null;
  onSelectRow?: (id: number) => void;
  onEditRow?: (id: number) => void;
  onRetireRow?: (id: number) => void;
};

export function CatalogList({ rows, selectedId, onSelectRow, onEditRow, onRetireRow }: Props) {
  return (
    <section data-testid="catalog-list" className="mt-2">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="h-8 px-2 text-xs font-semibold">Name</TableHead>
              <TableHead className="h-8 px-2 text-xs font-semibold">Stage</TableHead>
              <TableHead className="h-8 px-2 text-xs font-semibold">Mandatory</TableHead>
              <TableHead className="h-8 px-2 text-xs font-semibold">Status</TableHead>
              <TableHead className="h-8 px-2 text-xs font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="p-2 text-sm text-center py-12">
                  <p className="font-semibold text-slate-600">No catalog items yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Add the first required document type for your company above.
                  </p>
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={
                    selectedId === row.id ? 'bg-slate-100' : onSelectRow ? 'cursor-pointer' : undefined
                  }
                  onClick={() => onSelectRow?.(row.id)}
                >
                  <TableCell className="p-2 text-sm">
                    <span
                      className={row.active ? undefined : 'text-slate-400 line-through'}
                    >
                      {row.name}
                    </span>
                    {row.purpose ? (
                      <span
                        className="block truncate max-w-[200px] text-muted-foreground text-xs mt-0.5"
                        title={row.purpose}
                      >
                        {row.purpose}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="p-2 text-sm">{row.stage}</TableCell>
                  <TableCell className="p-2 text-sm">
                    <Badge variant="outline">{row.mandatory ? 'Yes' : 'No'}</Badge>
                  </TableCell>
                  <TableCell className="p-2 text-sm">
                    <Badge variant="outline">{row.active ? 'Active' : 'Retired'}</Badge>
                  </TableCell>
                  <TableCell className="p-2 text-sm">
                    <div
                      className="flex flex-wrap gap-1"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    >
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => onEditRow?.(row.id)}
                      >
                        Edit catalog item
                      </Button>
                      {row.active ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => onRetireRow?.(row.id)}
                        >
                          Retire item
                        </Button>
                      ) : null}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
