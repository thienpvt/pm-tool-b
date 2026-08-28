// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadBlob } from './downloadBlob';

describe('downloadBlob', () => {
  const click = vi.fn();
  const createObjectURL = vi.fn(() => 'blob:mock-url');
  const revokeObjectURL = vi.fn();

  beforeEach(() => {
    click.mockClear();
    createObjectURL.mockClear();
    revokeObjectURL.mockClear();
    vi.stubGlobal('URL', {
      createObjectURL,
      revokeObjectURL,
    });
    vi.spyOn(document, 'createElement').mockReturnValue({
      href: '',
      download: '',
      click,
    } as unknown as HTMLAnchorElement);
  });

  it('creates object URL, clicks anchor, and revokes URL', () => {
    const blob = new Blob(['test'], { type: 'application/octet-stream' });
    downloadBlob(blob, 'portfolio-dashboard.xlsx');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
  });
});
