'use client';

import { AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Sidebar from '@/components/layout/Sidebar';
import { useDocumentCatalog } from './useDocumentCatalog';

const ERROR_COPY = {
  unauthorized: 'Session expired — refresh the page and sign in again.',
  forbidden: "You don't have access to this page.",
  load_failed: "Couldn't load this page. Try again.",
} as const;

export default function DocumentCatalogPage() {
  const { data, loading, error } = useDocumentCatalog();

  if (loading) {
    return (
      <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-400 text-sm">Loading document catalog…</p>
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

  const activeCount = data.filter((row) => row.active).length;

  return (
    <div className="flex flex-col lg:flex-row min-h-screen bg-slate-50">
      <Sidebar />
      <main className="flex-1 p-4 lg:p-6 lg:p-8 overflow-auto">
        <div className="mb-4">
          <h1 className="text-base font-semibold">Document catalog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {activeCount} item{activeCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="h-8 px-2 text-xs font-semibold">Name</TableHead>
                <TableHead className="h-8 px-2 text-xs font-semibold">Stage</TableHead>
                <TableHead className="h-8 px-2 text-xs font-semibold">Mandatory</TableHead>
                <TableHead className="h-8 px-2 text-xs font-semibold">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="p-2 text-sm">
                    <span
                      className={
                        row.active ? undefined : 'text-slate-400 line-through'
                      }
                    >
                      {row.name}
                    </span>
                  </TableCell>
                  <TableCell className="p-2 text-sm">{row.stage}</TableCell>
                  <TableCell className="p-2 text-sm">
                    <Badge variant="outline">{row.mandatory ? 'Yes' : 'No'}</Badge>
                  </TableCell>
                  <TableCell className="p-2 text-sm">
                    <Badge variant="outline">{row.active ? 'Active' : 'Retired'}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </main>
    </div>
  );
}
