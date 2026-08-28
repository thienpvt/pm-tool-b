import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('project hub Document checklist card', () => {
  it('includes Document checklist quick link and keeps Documents card', () => {
    const src = readFileSync(join(process.cwd(), 'app/projects/[id]/page.tsx'), 'utf8');

    expect(src).toContain("label: 'Document checklist'");
    expect(src).toContain("desc: 'Complete Confluence evidence for this stage.'");
    expect(src).toContain("href: '/document-checklist'");

    expect(src).toContain("label: 'Documents'");
    expect(src).toContain("href: '/documents'");
  });
});
