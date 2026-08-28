/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { auditRowsFixture } from '@/modules/documents/ui/shared/documents.fixture';
import { useAuditLog } from './useAuditLog';

describe('useAuditLog', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores stale GET responses when filters change quickly', async () => {
    const catalogRows = auditRowsFixture.filter((r) => r.entity_type === 'document_catalog');
    const checklistRows = auditRowsFixture.filter(
      (r) => r.entity_type === 'project_document_checklist',
    );

    const pending: Record<string, (value: unknown) => void> = {};
    let fetchCount = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) => {
        fetchCount += 1;
        if (fetchCount === 1) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(auditRowsFixture),
          });
        }
        if (typeof url === 'string' && url.startsWith('/api/audit')) {
          return new Promise((resolve) => {
            pending[url] = (value) =>
              resolve({
                ok: true,
                status: 200,
                json: () => Promise.resolve(value),
              });
          });
        }
        return Promise.reject(new Error(`unexpected fetch: ${url}`));
      }) as unknown as typeof fetch,
    );

    const { result } = renderHook(() => useAuditLog());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(auditRowsFixture);
    });

    await act(async () => {
      void result.current.load({ entity_type: 'document_catalog', limit: 50 }, true);
      void result.current.load({ entity_type: 'project_document_checklist', limit: 50 }, true);
    });

    const checklistUrl = Object.keys(pending).find((url) =>
      url.includes('entity_type=project_document_checklist'),
    )!;
    const catalogUrl = Object.keys(pending).find((url) =>
      url.includes('entity_type=document_catalog'),
    )!;

    await act(async () => {
      pending[checklistUrl]!(checklistRows);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(checklistRows);
    });

    await act(async () => {
      pending[catalogUrl]!(catalogRows);
    });

    await waitFor(() => {
      expect(result.current.data).toEqual(checklistRows);
    });
  });
});
