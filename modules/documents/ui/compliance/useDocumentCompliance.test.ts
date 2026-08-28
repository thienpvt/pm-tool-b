/** @vitest-environment jsdom */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { complianceFixture } from '../shared/documents.fixture';
import { useDocumentCompliance } from './useDocumentCompliance';

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

describe('useDocumentCompliance', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('ignores stale GET responses when filters change quickly', async () => {
    const l2Payload = {
      filters: { stage: 'L2' },
      projects: [{ ...complianceFixture.projects[0]!, name: 'L2 Project' }],
    };
    const redPayload = {
      filters: { rag: 'Red' },
      projects: [{ ...complianceFixture.projects[0]!, name: 'Red RAG Project' }],
    };

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
            json: () => Promise.resolve(complianceFixture),
          });
        }
        if (typeof url === 'string' && url.startsWith('/api/dashboards/document-compliance')) {
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

    const { result } = renderHook(() => useDocumentCompliance());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data?.projects[0]?.name).toBe('Alpha Project');
    });

    await act(async () => {
      void result.current.load({ stage: 'L2' }, true);
      void result.current.load({ rag: 'Red' }, true);
    });

    const redUrl = Object.keys(pending).find((url) => url.includes('rag=Red'))!;
    const l2Url = Object.keys(pending).find(
      (url) => url.includes('stage=L2') && !url.includes('rag=Red'),
    )!;

    await act(async () => {
      pending[redUrl]!(redPayload);
    });

    await waitFor(() => {
      expect(result.current.data?.projects[0]?.name).toBe('Red RAG Project');
    });

    await act(async () => {
      pending[l2Url]!(l2Payload);
    });

    await waitFor(() => {
      expect(result.current.data?.projects[0]?.name).toBe('Red RAG Project');
    });
  });
});
